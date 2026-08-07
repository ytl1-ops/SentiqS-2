
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'SentinelAfrica-Bot/1.0 (+https://ytl1-ops.github.io/SentiqS; veille securite Afrique; usage non commercial)';
const TIMEOUT_MS = 8000;
const DELAY_BETWEEN_MS = 200;
const DOMAIN_THROTTLE_MS = 1500;

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
  try { return new URL(url).hostname; } catch { return null; }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // Get schedule config
    const { data: schedule } = await supabase
      .from('scan_schedule')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const isEnabled = schedule?.enabled ?? false;
    const intervalHours = schedule?.interval_hours ?? 6;
    const now = new Date();
    const nextRun = schedule?.next_run ? new Date(schedule.next_run) : null;

    // Determine if scan is due
    const isDue = !nextRun || now >= nextRun;
    const shouldRun = isEnabled && isDue;

    // Always return schedule info
    const scheduleInfo = {
      enabled: isEnabled,
      interval_hours: intervalHours,
      last_run: schedule?.last_run ?? null,
      next_run: schedule?.next_run ?? null,
      is_due: isDue,
      will_run: shouldRun,
    };

    if (!shouldRun) {
      return new Response(
        JSON.stringify({ success: true, schedule: scheduleInfo, scan_performed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Run the scan ----
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, source_url, title')
      .not('source_url', 'is', null)
      .order('id');

    if (feedsError) throw feedsError;

    const results = {
      total: feeds?.length ?? 0,
      active: 0,
      warning: 0,
      dead: 0,
      rss_validated: 0,
      total_articles_detected: 0,
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

      await supabase
        .from('feeds')
        .update({
          source_status: status,
          last_link_check: now.toISOString(),
          link_check_error: errorMsg,
          nb_articles_last_check: nbArticles,
          rss_validated: rssValid,
        })
        .eq('id', feed.id);
    }

    // Update schedule
    const nextRunDate = new Date(now.getTime() + intervalHours * 3600 * 1000);
    await supabase
      .from('scan_schedule')
      .update({
        last_run: now.toISOString(),
        next_run: nextRunDate.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', 1);

    scheduleInfo.last_run = now.toISOString();
    scheduleInfo.next_run = nextRunDate.toISOString();
    scheduleInfo.is_due = false;
    scheduleInfo.will_run = false;

    // Log activity
    // NB: le payload doit correspondre au schéma réel de activity_log
    // (type, message, details jsonb, country_code, analyst_initials, created_at) —
    // l'ancien payload (action/details-string/timestamp) référençait des colonnes
    // inexistantes et échouait silencieusement à chaque scan.
    await supabase.from('activity_log').insert({
      type: 'auto_change',
      message: `Scan planifié terminé — ${results.active} actif(s), ${results.warning} avertissement(s), ${results.dead} mort(s) sur ${results.total} flux`,
      details: {
        source: 'scheduled_scan',
        total: results.total,
        active: results.active,
        warning: results.warning,
        dead: results.dead,
        rss_validated: results.rss_validated,
        total_articles: results.total_articles_detected,
      },
      country_code: null,
      analyst_initials: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        schedule: scheduleInfo,
        scan_performed: true,
        summary: {
          total: results.total,
          active: results.active,
          warning: results.warning,
          dead: results.dead,
          rss_validated: results.rss_validated,
          total_articles_detected: results.total_articles_detected,
          checked_at: now.toISOString(),
        },
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
