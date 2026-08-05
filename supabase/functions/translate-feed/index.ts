import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// Claude translation prompt — strict security intelligence context
// NB: on ne présuppose JAMAIS la langue source — les flux proviennent de
// dizaines de sources (français, anglais, arabe, portugais...). Le modèle
// détecte la langue source lui-même ; lui affirmer une langue source
// erronée (bug précédent : sourceLang toujours 'fr') le faisait échouer
// silencieusement sur tout contenu non-français.
function buildTranslationPrompt(text: string, targetLang: string): string {
  const langName = targetLang === 'fr' ? 'français' : 'English';

  return `You are an elite security intelligence translator for SentiqS, a strategic monitoring platform covering 54 African countries. Your translations must be precise, operational-grade, and maintain full fidelity to the source.

Detect the source language automatically and translate the following security intelligence text into ${langName}.

CRITICAL RULES:
1. Preserve ALL factual details exactly: names, places, dates, numbers, casualty counts, organization names
2. Do NOT add, omit, or alter any intelligence — this is operational data, not creative writing
3. Maintain the same tone: professional, concise, intelligence-briefing style
4. Keep proper nouns in their original form (e.g. "Boko Haram" stays "Boko Haram", "Gao" stays "Gao")
5. If the text contains acronyms (e.g. FDS, EIGS, MINUSMA), keep them unchanged
6. Output ONLY the translated text — no explanations, no notes, no markdown, no quotes around the result
7. If the text is already in ${langName}, return it unchanged exactly as given

Text to translate:
${text}`;
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

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        error: 'MISSING_API_KEY',
        detail: 'ANTHROPIC_API_KEY secret not configured on this Supabase project (Project Settings → Edge Functions → Secrets).',
      }), { status: 503, headers });
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

    // Translate title
    if (feed.title) {
      const titlePrompt = buildTranslationPrompt(feed.title, lang);

      const titleResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          temperature: 0.1,
          system: 'You are a military-grade security intelligence translator. Output only the translation, no commentary.',
          messages: [{ role: 'user', content: titlePrompt }],
        }),
      });

      if (titleResp.ok) {
        const titleData = await titleResp.json();
        const titleContent = titleData?.content?.[0]?.text?.trim() || '';
        results.translated_title = titleContent || feed.title;
      } else {
        apiError = `Anthropic API ${titleResp.status}: ${(await titleResp.text()).substring(0, 300)}`;
        results.translated_title = feed.title;
      }
    }

    // Translate summary if it exists
    if (feed.summary) {
      const summaryPrompt = buildTranslationPrompt(feed.summary, lang);

      const summaryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          temperature: 0.1,
          system: 'You are a military-grade security intelligence translator. Output only the translation, no commentary.',
          messages: [{ role: 'user', content: summaryPrompt }],
        }),
      });

      if (summaryResp.ok) {
        const summaryData = await summaryResp.json();
        const summaryContent = summaryData?.content?.[0]?.text?.trim() || '';
        results.translated_summary = summaryContent || feed.summary;
      } else {
        apiError = apiError || `Anthropic API ${summaryResp.status}: ${(await summaryResp.text()).substring(0, 300)}`;
        results.translated_summary = feed.summary;
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
