import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — purge-synthetic-feeds v1.0
// Edge Function pour auditer et supprimer les feeds synthétiques.
// Porte la logique de src/utils/realDataGuard.ts en Deno.
// ============================================================

// ---------- SYNTHETIC ID PATTERNS (sync avec src/utils/realDataGuard.ts) ----------

const SYNTHETIC_ID_PATTERNS: RegExp[] = [
  /^feed-\d+$/,
  /^FLX-/,
  /^[a-z]{2}-feed-/,
  /^feed-rss-/,
  /-extra-/,
];

// ---------- NON-ARTICLE DOMAINS ----------

const NON_ARTICLE_DOMAINS = new Set([
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'search.yahoo.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
]);

// ---------- PORTED GUARD LOGIC ----------

function isSyntheticId(id: string): boolean {
  return SYNTHETIC_ID_PATTERNS.some((p) => p.test(id));
}

function isArticleUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (NON_ARTICLE_DOMAINS.has(parsed.hostname)) return false;
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') return false;
    const segments = pathname.split('/').filter(Boolean);
    return segments.length > 0;
  } catch {
    return false;
  }
}

interface FeedRow {
  id: string;
  rss_validated?: boolean | null;
  source_url?: string | null;
  source_status?: string | null;
  verification_status?: string | null;
  hallucination_score?: number | null;
  [key: string]: unknown;
}

interface FeedClassification {
  feedId: string;
  isReal: boolean;
  isSynthetic: boolean;
  reasons: string[];
}

function classifyFeed(feed: FeedRow): FeedClassification {
  const reasons: string[] = [];
  const synthetic = isSyntheticId(feed.id);

  if (synthetic) {
    reasons.push('ID synthétique');
  }

  if (feed.rss_validated !== true) {
    reasons.push('rss_validated !== true');
  }

  if (!isArticleUrl(feed.source_url)) {
    reasons.push(`source_url non article: ${feed.source_url ?? 'null'}`);
  }

  if (feed.source_status === 'dead') {
    reasons.push('source_status = dead');
  }

  if (feed.verification_status !== 'verified' && feed.verification_status !== 'confirmed') {
    reasons.push(`verification_status = ${feed.verification_status ?? 'null'}`);
  }

  if (feed.hallucination_score === null || feed.hallucination_score === undefined) {
    reasons.push('hallucination_score manquant');
  } else if (feed.hallucination_score > 0.3) {
    reasons.push(`hallucination_score = ${feed.hallucination_score} (> 0.3)`);
  }

  return {
    feedId: feed.id,
    isReal: reasons.length === 0,
    isSynthetic: synthetic,
    reasons,
  };
}

// ---------- AUDIT REPORT ----------

interface AuditReport {
  mode: 'audit';
  audited_at: string;
  total: number;
  nb_synthetic: number;
  nb_real: number;
  synthetic_ids: string[];
  real_ids: string[];
  classifications: FeedClassification[];
}

async function runAudit(supabaseClient: ReturnType<typeof createClient>): Promise<Response> {
  const { data: feeds, error } = await supabaseClient
    .from('feeds')
    .select('id, rss_validated, source_url, source_status, verification_status, hallucination_score');

  if (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'DB_SELECT_FAILED',
      detail: error.message,
    }), { status: 500, headers: corsHeaders() });
  }

  const rows: FeedRow[] = (feeds ?? []) as FeedRow[];
  const classifications: FeedClassification[] = rows.map(classifyFeed);
  const syntheticIds = classifications.filter((c) => c.isSynthetic).map((c) => c.feedId);
  const realIds = classifications.filter((c) => c.isReal).map((c) => c.feedId);

  const report: AuditReport = {
    mode: 'audit',
    audited_at: new Date().toISOString(),
    total: rows.length,
    nb_synthetic: syntheticIds.length,
    nb_real: realIds.length,
    synthetic_ids: syntheticIds,
    real_ids: realIds,
    classifications,
  };

  return new Response(JSON.stringify({ success: true, report }), { headers: corsHeaders() });
}

// ---------- DELETE MODE ----------

interface DeleteReport {
  mode: 'delete';
  executed_at: string;
  synthetic_before: number;
  deleted: number;
  deleted_ids: string[];
  errors: string[];
}

async function runDelete(supabaseClient: ReturnType<typeof createClient>): Promise<Response> {
  // 1. Re-run classification
  const { data: feeds, error: selectErr } = await supabaseClient
    .from('feeds')
    .select('id, rss_validated, source_url, source_status, verification_status, hallucination_score');

  if (selectErr) {
    return new Response(JSON.stringify({
      success: false,
      error: 'DB_SELECT_FAILED',
      detail: selectErr.message,
    }), { status: 500, headers: corsHeaders() });
  }

  const rows: FeedRow[] = (feeds ?? []) as FeedRow[];
  const syntheticIds = rows.filter((f) => isSyntheticId(f.id)).map((f) => f.id);

  if (syntheticIds.length === 0) {
    const report: DeleteReport = {
      mode: 'delete',
      executed_at: new Date().toISOString(),
      synthetic_before: 0,
      deleted: 0,
      deleted_ids: [],
      errors: [],
    };
    return new Response(JSON.stringify({ success: true, report }), { headers: corsHeaders() });
  }

  // 2. Delete only synthetic rows (one by one to avoid FK issues, or use .in filter)
  const deleted: string[] = [];
  const errors: string[] = [];

  // Delete in batches of 50 to stay safe
  const BATCH_SIZE = 50;
  for (let i = 0; i < syntheticIds.length; i += BATCH_SIZE) {
    const batch = syntheticIds.slice(i, i + BATCH_SIZE);
    const { error: delErr } = await supabaseClient
      .from('feeds')
      .delete()
      .in('id', batch);

    if (delErr) {
      errors.push(`Batch ${i / BATCH_SIZE}: ${delErr.message}`);
    } else {
      deleted.push(...batch);
    }
  }

  const report: DeleteReport = {
    mode: 'delete',
    executed_at: new Date().toISOString(),
    synthetic_before: syntheticIds.length,
    deleted: deleted.length,
    deleted_ids: deleted,
    errors,
  };

  return new Response(JSON.stringify({ success: true, report }), { headers: corsHeaders() });
}

// ---------- HELPERS ----------

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ============ MAIN ============

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      detail: 'POST uniquement.',
    }), { status: 405, headers: corsHeaders() });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: 'INVALID_JSON',
      detail: 'Corps JSON invalide.',
    }), { status: 400, headers: corsHeaders() });
  }

  const mode = (body.mode as string) || 'audit';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  if (mode === 'audit') {
    return await runAudit(supabase);
  }

  if (mode === 'delete') {
    const confirm = body.confirm;
    if (confirm !== 'JE_CONFIRME_LA_SUPPRESSION') {
      return new Response(JSON.stringify({
        success: false,
        error: 'CONFIRMATION_REQUIRED',
        detail: 'Le champ confirm doit valoir exactement "JE_CONFIRME_LA_SUPPRESSION".',
      }), { status: 400, headers: corsHeaders() });
    }
    return await runDelete(supabase);
  }

  return new Response(JSON.stringify({
    success: false,
    error: 'INVALID_MODE',
    detail: `Mode "${mode}" inconnu. Utiliser "audit" ou "delete".`,
  }), { status: 400, headers: corsHeaders() });
});
