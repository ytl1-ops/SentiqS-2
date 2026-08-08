import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'SentinelAfrica-Bot/1.0 (+https://ytl1-ops.github.io/SentiqS; veille securite Afrique; usage non commercial)';
const TIMEOUT_MS = 10000;
const DELAY_BETWEEN_MS = 200;
const DOMAIN_THROTTLE_MS = 1500;
const MAX_ITEMS_PER_SOURCE = 30;

interface FeedSource {
  id: number;
  name: string;
  url: string;
  country: string | null;
  category: string | null;
}

interface ParsedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : '';
}

function extractAtomLink(block: string): string {
  const regex = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i;
  const match = block.match(regex);
  return match ? match[1] : '';
}

function parseRSS(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAtomLink(block);
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    if (title && link) {
      items.push({ title, link, description, pubDate: pubDate || null });
    }
  }

  if (items.length === 0) {
    const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const block of atomEntries) {
      const title = extractTag(block, 'title');
      const link = extractAtomLink(block);
      const description = extractTag(block, 'summary') || extractTag(block, 'content');
      const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');
      if (title && link) {
        items.push({ title, link, description, pubDate: pubDate || null });
      }
    }
  }

  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

function parseDate(raw: string | null): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: sources, error: sourcesError } = await supabase
      .from('feed_sources')
      .select('id, name, url, country, category')
      .eq('active', true)
      .order('id');

    if (sourcesError) throw sourcesError;

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aucune source active dans feed_sources — rien à ingérer.',
          sources_processed: 0,
          items_inserted: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domainLastCall = new Map<string, number>();
    async function throttleByDomain(url: string) {
      const domain = getDomain(url);
      if (!domain) return;
      const last = domainLastCall.get(domain) || 0;
      const wait = DOMAIN_THROTTLE_MS - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      domainLastCall.set(domain, Date.now());
    }

    let totalInserted = 0;
    let totalSkippedDuplicate = 0;
    let sourcesOk = 0;
    let sourcesFailed = 0;
    const perSourceDetails: Array<{ source: string; status: string; inserted: number; error?: string }> = [];

    for (const source of sources as FeedSource[]) {
      await sleep(DELAY_BETWEEN_MS);
      await throttleByDomain(source.url);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(source.url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
          },
          redirect: 'follow',
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const xml = await response.text();
        const items = parseRSS(xml);

        let insertedForSource = 0;

        for (const item of items) {
          const { data: existing } = await supabase
            .from('feeds')
            .select('id')
            .eq('source_url', item.link)
            .maybeSingle();

          if (existing) {
            totalSkippedDuplicate++;
            continue;
          }

          const { error: insertError } = await supabase.from('feeds').insert({
            title: item.title,
            source: source.name,
            source_url: item.link,
            timestamp: parseDate(item.pubDate),
            category: source.category,
            country: source.country,
            summary: item.description || null,
            verification_status: 'unverified',
            hallucination_score: 0,
            source_status: 'active',
            last_link_check: new Date().toISOString(),
          });

          if (!insertError) {
            insertedForSource++;
            totalInserted++;
          }
        }

        await supabase
          .from('feed_sources')
          .update({ last_fetch_at: new Date().toISOString(), last_fetch_status: 'ok', last_fetch_error: null })
          .eq('id', source.id);

        sourcesOk++;
        perSourceDetails.push({ source: source.name, status: 'ok', inserted: insertedForSource });
      } catch (e: unknown) {
        const err = e as Error;
        sourcesFailed++;
        perSourceDetails.push({ source: source.name, status: 'error', inserted: 0, error: err.message });

        await supabase
          .from('feed_sources')
          .update({ last_fetch_at: new Date().toISOString(), last_fetch_status: 'error', last_fetch_error: err.message })
          .eq('id', source.id);
      }
    }

    await supabase.from('activity_log').insert({
      type: 'auto_change',
      message: `Ingestion RSS terminée — ${totalInserted} nouvel(s) article(s) sur ${sourcesOk}/${sources.length} sources`,
      details: {
        source: 'ingest_feeds',
        sources_ok: sourcesOk,
        sources_failed: sourcesFailed,
        items_inserted: totalInserted,
        items_skipped_duplicate: totalSkippedDuplicate,
      },
      country_code: null,
      analyst_initials: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sources_processed: sources.length,
        sources_ok: sourcesOk,
        sources_failed: sourcesFailed,
        items_inserted: totalInserted,
        items_skipped_duplicate: totalSkippedDuplicate,
        details: perSourceDetails,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
