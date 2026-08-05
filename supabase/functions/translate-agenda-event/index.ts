import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Traduction à la demande des événements d'agenda (titre + description),
// même mécanique que translate-feed : cache dans translated_title /
// translated_description / translation_lang, langue source non
// présupposée (le modèle la détecte lui-même).

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

function buildTranslationPrompt(text: string, targetLang: string): string {
  const langName = targetLang === 'fr' ? 'français' : 'English';
  return `You are an elite security intelligence translator for SentiqS, a strategic monitoring platform covering 54 African countries.

Detect the source language automatically and translate the following agenda/calendar entry text into ${langName}.

CRITICAL RULES:
1. Preserve ALL factual details exactly: names, places, dates, organization names
2. Keep proper nouns in their original form
3. Output ONLY the translated text — no explanations, no notes, no markdown, no quotes
4. If the text is already in ${langName}, return it unchanged exactly as given

Text to translate:
${text}`;
}

async function callClaude(text: string, targetLang: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.1,
      system: 'You are a military-grade security intelligence translator. Output only the translation, no commentary.',
      messages: [{ role: 'user', content: buildTranslationPrompt(text, targetLang) }],
    }),
  });
  if (!resp.ok) {
    return { ok: false, error: `Anthropic API ${resp.status}: ${(await resp.text()).substring(0, 300)}` };
  }
  const data = await resp.json();
  return { ok: true, text: data?.content?.[0]?.text?.trim() || text };
}

serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const { eventId, targetLang, force } = await req.json();
    if (!eventId) return new Response(JSON.stringify({ error: 'eventId required' }), { status: 400, headers });
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'MISSING_API_KEY', detail: 'ANTHROPIC_API_KEY secret not configured.' }), { status: 503, headers });
    }

    const lang = targetLang || 'fr';
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: event, error: fetchError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (fetchError || !event) {
      return new Response(JSON.stringify({ error: fetchError ? 'Fetch error' : 'Event not found', detail: fetchError?.message }), { status: 404, headers });
    }

    if (!force && event.translation_lang === lang && event.translated_title) {
      return new Response(JSON.stringify({
        eventId, translated: false, reason: 'already_translated',
        translated_title: event.translated_title,
        translated_description: event.translated_description,
        translation_lang: event.translation_lang,
      }), { headers });
    }

    const updateData: Record<string, unknown> = { translation_lang: lang, translated_at: new Date().toISOString() };

    if (event.title) {
      const r = await callClaude(event.title, lang);
      if (!r.ok) return new Response(JSON.stringify({ error: 'TRANSLATION_API_ERROR', detail: r.error }), { status: 502, headers });
      updateData.translated_title = r.text;
    }
    if (event.description) {
      const r = await callClaude(event.description, lang);
      if (!r.ok) return new Response(JSON.stringify({ error: 'TRANSLATION_API_ERROR', detail: r.error }), { status: 502, headers });
      updateData.translated_description = r.text;
    }

    const { error: updateError } = await supabase.from('agenda_events').update(updateData).eq('id', eventId);

    return new Response(JSON.stringify({
      eventId, translated: true, translation_lang: lang,
      translated_title: updateData.translated_title || event.title,
      translated_description: updateData.translated_description || event.description || '',
      updated: !updateError,
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: (err as Error).message }), { status: 500, headers });
  }
});
