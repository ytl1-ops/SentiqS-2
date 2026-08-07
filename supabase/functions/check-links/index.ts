import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'SentinelAfrica-Bot/1.0 (+https://ytl1-ops.github.io/SentiqS; veille securite Afrique; usage non commercial)';

const TIMEOUT_MS = 8000;
const DELAY_BETWEEN_MS = 200;
const DOMAIN_THROTTLE_MS = 1500;

// ═══ ANTI-TIMEOUT GUARDS ═══
const MAX_FEEDS_PER_RUN = 50;
const GLOBAL_TIMEOUT_MS = 45000;

function isValidRSS(text: string): boolean {
  if (!text || text.length < 200) return false;
  return (
    text.includes('<item') ||
    text.includes('<entry') ||
    text.includes('<rss') ||
    text.includes('<feed') ||
    text.includes('<?xml')
  );
}

function countArticles(text: string): number {
  const items = (text.match(/<item[\s>]/g) || []).length;
  const entries = (text.match(/<entry[\s>]/g) || []).length;
  return items + entries;
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: feeds, error } = await supabase
      .from('feeds')
      .select('id, source_url, title')
      .not('source_url', 'is', null)
      .order('last_link_check', { ascending: true, nullsFirst: true })
      .limit(MAX_FEEDS_PER_RUN);

    if (error) throw error;

    const results = {
      total: feeds?.length ?? 0,
      active: 0,
      warning: 0,
      dead: 0,
      rss_validated: 0,
      total_articles_detected: 0,
      truncated: false,
      details: [] as Array<{
        id: string;
        title: string;
        url: string;
        status: string;
        error: string | null;
        nb_articles: number;
        rss_valid: boolean;
      }>,
    };

    const domainLastCall = new Map<string, number>();

    async function throttleByDomain(url: string) {
      const domain = getDomain(url);
      if (!domain) return;
      const last = domainLastCall.get(domain) || 0;
      const wait = DOMAIN_THROTTLE_MS - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      domainLastCall.set(domain, Date.now());
    }

    for (const feed of feeds ?? []) {
      if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) {
        results.truncated = true;
        break;
      }

      await sleep(DELAY_BETWEEN_MS);
      await throttleByDomain(feed.source_url);

      let status = 'dead';
      let errorMsg: string | null = null;
      let nbArticles = 0;
      let rssValid = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(feed.source_url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.8, */*;q=0.5',
          },
          redirect: 'follow',
        });

        clearTimeout(timeoutId);
        const httpStatus = response.status;

        if (httpStatus >= 200 && httpStatus < 400) {
          const text = await response.text();
          rssValid = isValidRSS(text);
          nbArticles = rssValid ? countArticles(text) : 0;

          if (rssValid) {
            status = 'active';
            results.rss_validated++;
            results.total_articles_detected += nbArticles;
          } else {
            status = 'warning';
            errorMsg = `HTTP ${httpStatus} but content is not valid RSS/Atom (${text.length} chars)`;
          }
        } else if (httpStatus >= 400 && httpStatus < 500) {
          status = 'dead';
          errorMsg = `HTTP ${httpStatus} client error`;
        } else if (httpStatus >= 500) {
          status = 'warning';
          errorMsg = `HTTP ${httpStatus} server error`;
        }

      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === 'AbortError') {
          errorMsg = `Timeout after ${TIMEOUT_MS / 1000}s`;
        } else {
          errorMsg = err.message || 'Network error';
        }
        status = 'dead';
      }

      if (status === 'active') results.active++;
      else if (status === 'warning') results.warning++;
      else results.dead++;

      results.details.push({
        id: feed.id,
        title: feed.title,
        url: feed.source_url,
        status,
        error: errorMsg,
        nb_articles: nbArticles,
        rss_valid: rssValid,
      });

      await supabase
        .from('feeds')
        .update({
          source_status: status,
          last_link_check: new Date().toISOString(),
          link_check_error: errorMsg,
          nb_articles_last_check: nbArticles,
          rss_validated: rssValid,
        })
        .eq('id', feed.id);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.total,
          active: results.active,
          warning: results.warning,
          dead: results.dead,
          rss_validated: results.rss_validated,
          total_articles_detected: results.total_articles_detected,
          checked_at: new Date().toISOString(),
          elapsed_seconds: parseFloat(elapsed),
          truncated: results.truncated,
          max_per_run: MAX_FEEDS_PER_RUN,
        },
        details: results.details,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const err = error as Error;
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
