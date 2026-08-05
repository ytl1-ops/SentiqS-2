import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Traduction gratuite, sans clé, sans facturation — deux fournisseurs en
// cascade puisque les endpoints publics gratuits sont sujets à des
// limitations de débit imprévisibles depuis les IP partagées des Edge
// Functions. Google Translate (sl=auto) sait détecter la langue source
// nativement ; en repli, MyMemory nécessite une langue source explicite,
// estimée par une heuristique légère (jamais présupposée à 'fr' — bug
// précédent corrigé : les flux proviennent de dizaines de sources dans des
// langues différentes).

const FRENCH_MARKERS = /\b(le|la|les|des|une|un|dans|pour|avec|sur|qui|que|est|été|sont|leur|cette|selon|après|région|pays|gouvernement)\b/gi;
const FRENCH_ACCENTS = /[éèêàçùôî]/g;
const ENGLISH_MARKERS = /\b(the|and|for|with|has|been|from|this|that|are|was|were|said|will|their|after|according|country|government)\b/gi;

function guessSourceLang(text: string): 'fr' | 'en' {
  const frenchScore = (text.match(FRENCH_MARKERS)?.length || 0) + (text.match(FRENCH_ACCENTS)?.length || 0) * 0.5;
  const englishScore = text.match(ENGLISH_MARKERS)?.length || 0;
  return frenchScore >= englishScore ? 'fr' : 'en';
}

async function translateViaGoogle(text: string, targetLang: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    return { ok: false, error: `Google Translate ${resp.status}: ${(await resp.text()).substring(0, 200)}` };
  }
  const data = await resp.json();
  const chunks = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = chunks.map((chunk: unknown[]) => chunk?.[0] ?? '').join('').trim();
  if (!translated) return { ok: false, error: 'Google Translate: empty response' };
  return { ok: true, text: translated };
}

async function translateViaMyMemory(text: string, targetLang: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const sourceLang = targetLang === 'fr' ? 'en' : 'fr';
  const detected = guessSourceLang(text);
  const source = detected === targetLang ? sourceLang : detected;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${targetLang}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    return { ok: false, error: `MyMemory ${resp.status}: ${(await resp.text()).substring(0, 200)}` };
  }
  const data = await resp.json();
  const translated = data?.responseData?.translatedText?.trim();
  if (!translated || data?.responseStatus >= 400) {
    return { ok: false, error: `MyMemory: ${data?.responseDetails || 'empty response'}` };
  }
  return { ok: true, text: translated };
}

async function translateText(text: string, targetLang: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const google = await translateViaGoogle(text, targetLang);
  if (google.ok) return google;

  const fallback = await translateViaMyMemory(text, targetLang);
  if (fallback.ok) return fallback;

  return { ok: false, error: `${google.error} | fallback: ${fallback.error}` };
}

serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { feedId, targetLang, force } = await req.json();

    if (!feedId) {
      return new Response(JSON.stringify({ error: 'feedId required' }), { status: 400, headers });
    }

    const lang = targetLang || 'fr';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the feed
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', feedId)
      .maybeSingle();

    if (fetchError || !feed) {
      return new Response(JSON.stringify({
        error: fetchError ? 'Fetch error' : 'Feed not found',
        detail: fetchError?.message,
      }), { status: 404, headers });
    }

    // If already translated and not forced, skip
    if (!force && feed.translation_lang === lang && feed.translated_title && feed.translated_summary) {
      return new Response(JSON.stringify({
        feedId,
        translated: false,
        reason: 'already_translated',
        translated_title: feed.translated_title,
        translated_summary: feed.translated_summary,
        translation_lang: feed.translation_lang,
      }), { headers });
    }

    const results: Record<string, string> = {};
    let apiError: string | null = null;

    if (feed.title) {
      const r = await translateText(feed.title, lang);
      if (r.ok) {
        results.translated_title = r.text;
      } else {
        apiError = r.error;
      }
    }

    if (feed.summary) {
      const r = await translateText(feed.summary, lang);
      if (r.ok) {
        results.translated_summary = r.text;
      } else {
        apiError = apiError || r.error;
      }
    }

    if (apiError) {
      return new Response(JSON.stringify({ error: 'TRANSLATION_API_ERROR', detail: apiError }), { status: 502, headers });
    }

    // Update feed in database
    const updateData: Record<string, unknown> = {
      translation_lang: lang,
      translated_at: new Date().toISOString(),
    };

    if (results.translated_title) {
      updateData.translated_title = results.translated_title;
    }
    if (results.translated_summary) {
      updateData.translated_summary = results.translated_summary;
    }

    const { error: updateError } = await supabase
      .from('feeds')
      .update(updateData)
      .eq('id', feedId);

    return new Response(JSON.stringify({
      feedId,
      translated: true,
      translation_lang: lang,
      translated_title: results.translated_title || feed.title,
      translated_summary: results.translated_summary || feed.summary || '',
      updated: !updateError,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});
