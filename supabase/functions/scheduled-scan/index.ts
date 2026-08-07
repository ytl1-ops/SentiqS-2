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
const MAX_FEEDS_PER_RUN = 30;
const GLOBAL_TIMEOUT_MS = 50000;

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

// ============================================================
// INTEGRITY GUARD — Phase 2 : anti-données factices
// ============================================================
const KNOWN_MEDIA_NAMES = new Set([
  "quartz africa", "nation media group", "this day nigeria", "punch nigeria",
  "the citizen tanzania", "the independent uganda", "le360 maroc", "telquel maroc",
  "the conversation africa", "nation media", "mediapart afrique", "les echos afrique",
  "allafrica", "africanews", "voa africa", "bbc africa", "dw afrique",
  "rfi afrique", "france 24", "al jazeera", "reuters afrique", "afp",
  "jeune afrique", "le monde afrique", "the africa report", "africa intelligence",
]);

interface IntegrityViolation {
  feed_id: string;
  feed_title: string;
  violation_type: string;
  severity: string;
  detail: string;
  auto_fixed: boolean;
}

interface IntegrityReport {
  scanned: number;
  violations: number;
  auto_fixed: number;
  breakdown: Record<string, number>;
  details: IntegrityViolation[];
}

function isSourceNameAsTitle(title: string): boolean {
  if (!title || title.length < 3) return false;
  const normalized = title.trim().toLowerCase();
  if (KNOWN_MEDIA_NAMES.has(normalized)) return true;
  if (title.trim().length <= 50) {
    const sourcePatterns = [
      /^(The |Le |La |Les )?(Independent|Guardian|Nation|Times|Standard|Citizen|Punch|Herald|Monitor|Tribune|Reporter|Observer|Chronicle|Gazette|Post|Mail|News|Mirror|Sun|Star|Echo|Voice|Journal|Daily|Weekly|Today|Report|Africa|Afrique)( .*)?$/i,
    ];
    for (const p of sourcePatterns) {
      if (p.test(title.trim())) return true;
    }
  }
  return false;
}

function isGenericDomainUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/$/, "");
    if (path === "" || path === "/") return true;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 1 && segments[0].length < 30) return true;
    return false;
  } catch {
    return false;
  }
}

async function runIntegrityGuard(
  supabase: ReturnType<typeof createClient>,
  now: Date,
  startTime: number,
): Promise<IntegrityReport> {
  const { data: feeds, error } = await supabase
    .from("feeds")
    .select("id, title, source_url, source_status, verification_status, hallucination_score, country, category, timestamp")
    .order("id")
    .limit(200); // limit to 200 for integrity scan

  if (error) throw error;

  const violations: IntegrityViolation[] = [];
  let autoFixed = 0;

  for (const feed of feeds || []) {
    // Global timeout guard for integrity phase too
    if (Date.now() - startTime > GLOBAL_TIMEOUT_MS - 5000) {
      break;
    }

    if (isSourceNameAsTitle(feed.title)) {
      violations.push({
        feed_id: feed.id,
        feed_title: feed.title,
        violation_type: "TITLE_IS_SOURCE_NAME",
        severity: "critical",
        detail: `Titre "${feed.title}" = nom de média, pas une actualité.`,
        auto_fixed: true,
      });
      await supabase.from("feeds").update({
        verification_status: "rumor",
        hallucination_score: 0.95,
      }).eq("id", feed.id);
      autoFixed++;
      continue;
    }

    if (feed.source_status === "dead" && (feed.verification_status === "verified" || feed.verification_status === "confirmed")) {
      violations.push({
        feed_id: feed.id,
        feed_title: feed.title,
        violation_type: "CONTRADICTORY_STATUS",
        severity: "critical",
        detail: `Source morte mais vérifié=${feed.verification_status}.`,
        auto_fixed: true,
      });
      await supabase.from("feeds").update({
        verification_status: "unverified",
        hallucination_score: Math.max(feed.hallucination_score ?? 0, 0.50),
      }).eq("id", feed.id);
      autoFixed++;
    }

    if (feed.source_url && isGenericDomainUrl(feed.source_url)) {
      const alreadyFlagged = feed.verification_status === "rumor" || feed.source_status === "dead";
      if (!alreadyFlagged) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "GENERIC_DOMAIN_URL",
          severity: "medium",
          detail: `URL "${feed.source_url}" = page d'accueil, pas un article.`,
          auto_fixed: false,
        });
      }
    }

    const score = feed.hallucination_score;
    if (score !== null && score !== undefined) {
      if (feed.source_status === "dead" && score < 0.35) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "SCORE_INCONSISTENCY",
          severity: "high",
          detail: `Score=${score} trop bas pour source morte.`,
          auto_fixed: true,
        });
        await supabase.from("feeds").update({ hallucination_score: 0.50 }).eq("id", feed.id);
        autoFixed++;
      }
      if (feed.verification_status === "rumor" && score < 0.60) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "SCORE_INCONSISTENCY",
          severity: "high",
          detail: `Score=${score} trop bas pour rumeur.`,
          auto_fixed: true,
        });
        await supabase.from("feeds").update({ hallucination_score: 0.78 }).eq("id", feed.id);
        autoFixed++;
      }
    }
  }

  return {
    scanned: feeds?.length || 0,
    violations: violations.length,
    auto_fixed: autoFixed,
    breakdown: {
      title_as_source: violations.filter(v => v.violation_type === "TITLE_IS_SOURCE_NAME").length,
      contradictory: violations.filter(v => v.violation_type === "CONTRADICTORY_STATUS").length,
      generic_domain: violations.filter(v => v.violation_type === "GENERIC_DOMAIN_URL").length,
      score_inconsistency: violations.filter(v => v.violation_type === "SCORE_INCONSISTENCY").length,
    },
    details: violations,
  };
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

    const isDue = !nextRun || now >= nextRun;
    const shouldRun = isEnabled && isDue;

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

    // ---- PHASE 1: Link check (RSS validation) ----
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, source_url, title')
      .not('source_url', 'is', null)
      .order('last_link_check', { ascending: true, nullsFirst: true })
      .limit(MAX_FEEDS_PER_RUN);

    if (feedsError) throw feedsError;

    const results = {
      total: feeds?.length ?? 0,
      active: 0,
      warning: 0,
      dead: 0,
      rss_validated: 0,
      total_articles_detected: 0,
      truncated: false,
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

    // ---- PHASE 2: Integrity Guard (anti-données factices) ----
    let integrityReport: IntegrityReport | null = null;
    if (Date.now() - startTime < GLOBAL_TIMEOUT_MS - 10000) {
      try {
        integrityReport = await runIntegrityGuard(supabase, now, startTime);
      } catch (igError: unknown) {
        console.error("Integrity guard phase failed:", (igError as Error).message);
      }
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

    const activityDetails: Record<string, unknown> = {
      phase_1_links: {
        total: results.total,
        active: results.active,
        warning: results.warning,
        dead: results.dead,
        rss_validated: results.rss_validated,
        total_articles: results.total_articles_detected,
        truncated: results.truncated,
      },
    };
    if (integrityReport) {
      activityDetails.phase_2_integrity_guard = {
        scanned: integrityReport.scanned,
        violations: integrityReport.violations,
        auto_fixed: integrityReport.auto_fixed,
        breakdown: integrityReport.breakdown,
      };
    }

    const activityMessage = integrityReport
      ? `Scan auto terminé — Phase 1 Liens: ${results.active} actifs, ${results.dead} morts | Phase 2 Intégrité: ${integrityReport.scanned} flux scannés, ${integrityReport.violations} violations, ${integrityReport.auto_fixed} auto-corrigées`
      : `Scan auto terminé — Phase 1 Liens: ${results.active} actifs, ${results.dead} morts | Phase 2 Intégrité: non exécutée (timeout)`;

    await supabase.from('activity_log').insert({
      type: 'scheduled_scan_completed',
      message: activityMessage,
      details: activityDetails,
      created_at: now.toISOString(),
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
          truncated: results.truncated,
          max_per_run: MAX_FEEDS_PER_RUN,
        },
        integrity_guard: integrityReport ? {
          scanned: integrityReport.scanned,
          violations_found: integrityReport.violations,
          auto_fixed: integrityReport.auto_fixed,
          breakdown: integrityReport.breakdown,
          details: integrityReport.details,
        } : { error: "Integrity guard phase skipped (timeout)" },
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
