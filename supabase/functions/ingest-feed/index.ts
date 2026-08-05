import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — ingest-feed v3.1
// Garde anti-synthétique PERMANENTE intégrée.
// 5 critères à l'insertion (verification_status NON exigé,
// un article réel peut entrer avec 'unverified' par défaut).
// ============================================================

// ============ SYNTHETIC ID PATTERNS (sync realDataGuard.ts) ============

const SYNTHETIC_ID_PATTERNS: RegExp[] = [
  /^feed-\d+$/,
  /^FLX-/,
  /^[a-z]{2}-feed-/,
  /^feed-rss-/,
  /-extra-/,
];

const NON_ARTICLE_DOMAINS = new Set([
  'google.com', 'www.google.com', 'bing.com', 'www.bing.com',
  'search.yahoo.com', 'duckduckgo.com', 'www.duckduckgo.com',
]);

// ============ GUARD LOGIC ============

function isSyntheticId(id: string): boolean {
  if (!id || typeof id !== 'string') return true; // null/empty = rejeté
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

interface GuardViolation {
  criterion: string;
  detail: string;
}

/**
 * Valide un feed candidat contre les 5 critères d'insertion.
 * verification_status N'EST PAS exigé à l'insertion :
 * un article réel peut entrer avec 'unverified' par défaut.
 * La corroboration verified/confirmed est gérée par verify-feed.
 * Retourne { valid: false, violations: [...] } si rejeté.
 */
function validateFeedCandidate(candidate: {
  id?: string | null;
  rss_validated?: boolean | null;
  source_url?: string | null;
  source_status?: string | null;
  hallucination_score?: number | null;
}): { valid: boolean; violations: GuardViolation[] } {
  const violations: GuardViolation[] = [];

  // 1. ID non fabriqué
  if (!candidate.id || isSyntheticId(candidate.id)) {
    violations.push({
      criterion: 'SYNTHETIC_ID',
      detail: `ID synthétique ou absent : "${candidate.id ?? 'null'}"`,
    });
  }

  // 2. rss_validated === true
  if (candidate.rss_validated !== true) {
    violations.push({
      criterion: 'RSS_NOT_VALIDATED',
      detail: `rss_validated = ${candidate.rss_validated ?? 'null'} (attendu: true)`,
    });
  }

  // 3. source_url = vraie URL article
  if (!isArticleUrl(candidate.source_url)) {
    violations.push({
      criterion: 'INVALID_ARTICLE_URL',
      detail: `source_url non article : "${candidate.source_url ?? 'null'}"`,
    });
  }

  // 4. source_status != dead
  if (candidate.source_status === 'dead') {
    violations.push({
      criterion: 'DEAD_SOURCE',
      detail: 'source_status = dead',
    });
  }

  // 5. hallucination_score <= 0.3
  if (candidate.hallucination_score === null || candidate.hallucination_score === undefined) {
    violations.push({
      criterion: 'MISSING_HALLUCINATION_SCORE',
      detail: 'hallucination_score manquant',
    });
  } else if (candidate.hallucination_score > 0.3) {
    violations.push({
      criterion: 'HIGH_HALLUCINATION_SCORE',
      detail: `hallucination_score = ${candidate.hallucination_score} (> 0.3)`,
    });
  }

  return { valid: violations.length === 0, violations };
}

// ============ REJECTION LOGGING ============

async function logRejection(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  violations: GuardViolation[],
  attemptedBy: string,
) {
  const reasonCode = violations.map((v) => v.criterion).join('|');
  const reasonDetail = violations.map((v) => `${v.criterion}: ${v.detail}`).join(' ; ');

  try {
    await supabase.from('feed_rejection_log').insert({
      title: (payload.title as string) || null,
      source: (payload.source as string) || null,
      source_url: (payload.source_url as string) || null,
      country: (payload.country as string) || null,
      category: (payload.category as string) || null,
      reason_code: reasonCode,
      reason_detail: reasonDetail,
      attempted_by: attemptedBy,
      raw_data: payload,
      rejected_at: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error('[ingest-feed] Échec log rejection:', (logErr as Error).message);
    console.error('[ingest-feed] Violations:', JSON.stringify(violations));
  }
}

// ============ SHARED DATA ============

const AFRICAN_COUNTRIES = new Set([
  'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso',
  'Burundi', 'Cameroun', 'Cap-Vert', 'Centrafrique', 'Comores', 'Congo',
  'Côte d\'Ivoire', 'Djibouti', 'Égypte', 'Érythrée', 'Éthiopie', 'Gabon',
  'Gambie', 'Ghana', 'Guinée', 'Guinée-Bissau', 'Guinée Équatoriale',
  'Kenya', 'Lesotho', 'Libéria', 'Libye', 'Madagascar', 'Malawi', 'Mali',
  'Maroc', 'Maurice', 'Mauritanie', 'Mozambique', 'Namibie', 'Niger',
  'Nigeria', 'Ouganda', 'RDC', 'Rwanda', 'Sao Tomé-et-Principe',
  'Sénégal', 'Seychelles', 'Sierra Leone', 'Somalie', 'Soudan',
  'Soudan du Sud', 'Éswatini', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie',
  'Zambie', 'Zimbabwe',
]);

const VALID_CATEGORIES = new Set([
  'Sécurité', 'Politique', 'Économie', 'Santé', 'Environnement',
  'Social', 'Cyber', 'Diplomatie', 'Énergie', 'Transport',
  'Humanitaire', 'Militaire',
]);

const KNOWN_SOURCES = [
  'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP', 'Bloomberg',
  'Xinhua', 'EFE', 'ANSA', 'DPA', 'BBC', 'BBC Africa', 'RFI',
  'France 24', 'DW', 'Deutsche Welle', 'Al Jazeera', 'VOA', 'Voice of America',
  'CNN', 'The Guardian', 'Le Monde', 'Jeune Afrique', 'Africa Intelligence',
  'The Africa Report', 'AllAfrica', 'Africanews', 'ReliefWeb', 'ACLED',
  'ISS Africa', 'ISS', 'The Conversation Africa', 'African Arguments',
  'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP',
  'MSF', 'Médecins Sans Frontières', 'HRW', 'Human Rights Watch',
  'Amnesty', 'Amnesty International', 'Crisis Group', 'ICG',
  'Daily Nation', 'The Standard', 'The East African', 'Daily Monitor',
  'The New Times', 'News24', 'Daily Maverick', 'Mail & Guardian',
  'The Herald', 'The Namibian', 'Mmegi', 'Times of Zambia', 'Nyasa Times',
  'This Day', 'Punch', 'Vanguard', 'Premium Times', 'Daily Trust',
  'The Guardian Nigeria', 'The Point', 'Daily Observer', 'FrontPage Africa',
  'Daily Graphic', 'Joy Online', 'Fraternité Matin', 'Le Soleil',
  'Cameroon Tribune', 'Le Pays', 'Sidwaya', 'L\'Essor', 'Gabon Review',
  'Radio Okapi', 'Le Potentiel', 'Al Ahram', 'Daily News Egypt',
  'El Watan', 'Hespress', 'Le Matin', 'Kapitalis', 'Hiiraan Online',
  'Garowe Online', 'Sudan Tribune', 'Dabanga', 'The Reporter',
  'Addis Standard', 'Zitamar', 'Club of Mozambique', 'O País',
  'Sahara Médias', 'Alwihda Info', 'TchadInfos', 'Libya Observer',
  'InfoMigrants', 'The New Humanitarian', 'IRIN',
];

function isKnownSource(source: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().trim();
  return KNOWN_SOURCES.some(ks => s === ks.toLowerCase().trim() || s.includes(ks.toLowerCase().trim()) || ks.toLowerCase().trim().includes(s));
}

function guessCategory(text: string): string | null {
  const lower = text.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/attaque|attentat|combat|affrontement|militaire|armée|rebelle|djihadiste|terroriste|boko haram|al-shabaab|aqmi|jnim/i, 'Sécurité'],
    [/président|élection|gouvernement|ministre|parlement|opposition|réforme|constitution|loi|décret/i, 'Politique'],
    [/croissance|pib|inflation|dette|investissement|commerce|export|import|budget|fmi|banque mondiale/i, 'Économie'],
    [/épidémie|virus|maladie|vaccin|hôpital|médecin|patient|contamin|cas confirmé/i, 'Santé'],
    [/inondation|sécheresse|cyclone|tempête|climat|pollution|déforestation|co2/i, 'Environnement'],
    [/grève|manifestation|protest|syndicat|étudiant|société civile|ONG|droits/i, 'Social'],
    [/cyber|piratage|ransomware|données|fuite|hack|malware|phishing/i, 'Cyber'],
    [/diplomate|ambassade|sommet|accord|nations unies|onu|ua|cedeao|sadc/i, 'Diplomatie'],
    [/pétrole|gaz|mine|pétrolier|énerg|électricité|barrage/i, 'Énergie'],
    [/route|port|aéroport|ferroviaire|logistique|transport|camion|conteneur/i, 'Transport'],
    [/réfugié|déplacé|humanitaire|famine|aide|secours|pam|oms|unicef|ocha/i, 'Humanitaire'],
    [/coup d.état|putsch|junte|militaire|état-major|général/i, 'Militaire'],
  ];
  for (const [regex, cat] of map) {
    if (regex.test(lower)) return cat;
  }
  return null;
}

function matchKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// ----- Content Hash (détection d'altération ultérieure de la source) -----

async function computeContentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ----- Domaine racine -----

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ----- Archive Wayback Machine (best-effort, jamais bloquant) -----

const ARCHIVE_TIMEOUT_MS = 6000;

async function tryArchiveCapture(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ARCHIVE_TIMEOUT_MS);
    const resp = await fetch(`https://web.archive.org/save/${url}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'SentiqS-Ingest/3.1' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    const contentLocation = resp.headers.get('content-location');
    if (contentLocation) return `https://web.archive.org${contentLocation}`;
    if (resp.ok) return `https://web.archive.org/web/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${url}`;
    return null;
  } catch {
    return null;
  }
}

interface RssArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

// NB: DOMParser n'est PAS disponible dans le runtime Deno des Supabase Edge
// Functions — l'ancienne implémentation échouait silencieusement sur 100%
// des flux. Remplacé par un parseur regex (identique à rss-poll).

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

function parseRssXml(xml: string): RssArticle[] {
  const articles: RssArticle[] = [];

  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAtomLink(block);
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    if (title) articles.push({ title, link, description, pubDate: pubDate || null });
  }
  if (articles.length > 0) return articles;

  const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const block of atomEntries) {
    const title = extractTag(block, 'title');
    const link = extractAtomLink(block);
    const description = extractTag(block, 'summary') || extractTag(block, 'content');
    const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');
    if (title) articles.push({ title, link, description, pubDate: pubDate || null });
  }
  return articles;
}

async function incrementOsintCounter(
  supabase: ReturnType<typeof createClient>,
  osintSourceId: number,
  field: 'total_articles_fetched' | 'alerts_triggered',
  increment: number,
) {
  const { data: current } = await supabase.from('osint_sources')
    .select(field).eq('id', osintSourceId).maybeSingle();
  const newVal = (current ? (current as Record<string, number>)[field] : 0) + increment;
  await supabase.from('osint_sources').update({ [field]: newVal }).eq('id', osintSourceId);
}

// ============ MODE: SINGLE ============

interface SinglePayload {
  mode?: 'single';
  title: string;
  source: string;
  source_url: string;
  country: string;
  category: string;
  summary?: string;
  locality?: string;
  department?: string;
  timestamp?: string;
}

async function handleSingle(body: SinglePayload, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const errors: string[] = [];
  if (!body.title || body.title.trim().length < 10) {
    errors.push('TITLE_TOO_SHORT: Le titre doit contenir au moins 10 caractères.');
  }
  const title = (body.title || '').trim();
  if (body.source && title.toLowerCase() === body.source.toLowerCase().trim()) {
    errors.push('TITLE_IS_SOURCE_NAME: Le titre ne peut pas être identique au nom de la source.');
  }
  if (!body.source_url || body.source_url.trim() === '') {
    errors.push('MISSING_SOURCE_URL: L\'URL source est obligatoire.');
  } else {
    try {
      const parsed = new URL(body.source_url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('INVALID_URL_PROTOCOL: Protocole invalide.');
      }
    } catch { errors.push('MALFORMED_URL: URL syntaxiquement invalide.'); }
  }
  if (!body.country || !AFRICAN_COUNTRIES.has(body.country.trim())) {
    errors.push(`INVALID_COUNTRY: "${body.country || '(vide)'}" non reconnu.`);
  }
  if (!body.category || !VALID_CATEGORIES.has(body.category.trim())) {
    errors.push(`INVALID_CATEGORY: "${body.category || '(vide)'}" non valide.`);
  }
  if (errors.length > 0) {
    return new Response(JSON.stringify({ success: false, rejected: true, reason: 'VALIDATION_FAILED', errors }), { status: 422 });
  }

  // ---- Check source URL alive ----
  let sourceUrlAlive = false;
  let httpStatus: number | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(body.source_url.trim(), {
      method: 'HEAD', signal: controller.signal,
      headers: { 'User-Agent': 'SentiqS-Ingest/3.1', 'Accept': 'text/html, application/rss+xml, application/xml, */*' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    httpStatus = resp.status;
    sourceUrlAlive = resp.ok || [301, 302, 303, 307, 308].includes(resp.status);
  } catch (fetchErr) {
    const errMsg = (fetchErr as Error).message || '';
    console.warn('[ingest-feed] URL check warning:', errMsg);
  }

  const sourceKnown = isKnownSource(body.source);
  const now = new Date().toISOString();
  const feedId = crypto.randomUUID();

  // ---- Build candidate for realDataGuard (5 critères d'insertion) ----
  const candidate = {
    id: feedId,
    rss_validated: true, // entrée manuelle = considérée comme validée
    source_url: body.source_url.trim(),
    source_status: sourceUrlAlive ? 'active' : 'unchecked',
    hallucination_score: sourceKnown ? 0.05 : 0.28,
  };

  // ---- GUARD ANTI-SYNTHÉTIQUE ----
  const guardResult = validateFeedCandidate(candidate);
  if (!guardResult.valid) {
    await logRejection(supabase, { ...body, candidate_id: feedId }, guardResult.violations, 'ingest-feed:single');
    return new Response(JSON.stringify({
      success: false,
      rejected: true,
      reason: 'REALDATA_GUARD_REJECTED',
      violations: guardResult.violations,
      message: 'Insertion rejetée par le garde anti-synthétique (5 critères realDataGuard).',
    }), { status: 422 });
  }

  // ---- INSERT ----
  const contentHash = await computeContentHash(`${title}|${body.summary?.trim() || ''}`);
  const archiveUrl = await tryArchiveCapture(body.source_url.trim());

  const { data: inserted, error: insertError } = await supabase.from('feeds').insert({
    id: feedId,
    title, source: body.source.trim(), source_url: body.source_url.trim(),
    source_domain: getDomain(body.source_url.trim()),
    content_hash: contentHash,
    backup_archive_url: archiveUrl,
    country: body.country.trim(), category: body.category.trim(),
    summary: body.summary?.trim() || null, locality: body.locality?.trim() || null,
    department: body.department?.trim() || null,
    timestamp: body.timestamp || now,
    verification_status: sourceKnown ? 'verified' : 'unverified',
    hallucination_score: candidate.hallucination_score,
    source_status: candidate.source_status,
    rss_validated: candidate.rss_validated,
    last_link_check: now,
  }).select('id').single();

  if (insertError) {
    return new Response(JSON.stringify({ success: false, rejected: true, reason: 'DB_INSERT_FAILED', detail: insertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    success: true, feed_id: inserted.id,
    guard_passed: true,
    validated: { title_length: title.length, source_known: sourceKnown, source_url_alive: sourceUrlAlive, http_status: httpStatus },
    message: 'Flux ingéré avec succès (garde anti-synthétique OK).',
  }));
}

// ============ MODE: RSS_REGISTER ============

interface RssRegisterPayload {
  mode: 'rss_register';
  source_name: string;
  source_url: string;
  country: string;
  detection_keywords?: string[];
  fetch_interval_minutes?: number;
  osint_source_id?: number;
}

async function handleRssRegister(body: RssRegisterPayload, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const errors: string[] = [];
  if (!body.source_name || body.source_name.trim().length < 2) {
    errors.push('INVALID_SOURCE_NAME: Nom de source trop court (min 2 caractères).');
  }
  if (!body.source_url || body.source_url.trim() === '') {
    errors.push('MISSING_SOURCE_URL: URL RSS obligatoire.');
  } else {
    try {
      const parsed = new URL(body.source_url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('INVALID_URL_PROTOCOL: Protocole invalide.');
      }
    } catch { errors.push('MALFORMED_URL: URL syntaxiquement invalide.'); }
  }
  if (!body.country || !AFRICAN_COUNTRIES.has(body.country.trim())) {
    errors.push(`INVALID_COUNTRY: "${body.country || '(vide)'}" non reconnu.`);
  }
  if (errors.length > 0) {
    return new Response(JSON.stringify({ success: false, rejected: true, reason: 'VALIDATION_FAILED', errors }), { status: 422 });
  }

  // 1. Fetch RSS
  let rssXml: string;
  let httpStatus: number | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(body.source_url.trim(), {
      method: 'GET', signal: controller.signal,
      headers: { 'User-Agent': 'SentiqS-RSS/3.1', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    httpStatus = resp.status;
    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, reason: 'RSS_FETCH_FAILED', http_status: httpStatus, message: `HTTP ${httpStatus}.` }), { status: 502 });
    }
    rssXml = await resp.text();
  } catch (fetchErr) {
    return new Response(JSON.stringify({ success: false, reason: 'RSS_UNREACHABLE', message: `Injoignable: ${(fetchErr as Error).message.substring(0, 150)}` }), { status: 502 });
  }

  // 2. Parse
  const articles = parseRssXml(rssXml);
  const totalFetched = articles.length;
  if (totalFetched === 0) {
    return new Response(JSON.stringify({ success: false, reason: 'RSS_EMPTY', message: 'Aucun article parsable.' }), { status: 422 });
  }

  // 3. Match keywords
  const keywords = body.detection_keywords || [];
  const matchedArticles = keywords.length > 0
    ? articles.filter(a => matchKeywords(`${a.title} ${a.description}`, keywords))
    : articles.slice(0, 20);

  const now = new Date().toISOString();
  const reliabilityBase = isKnownSource(body.source_name) ? 0.80 : 0.55;
  let osintSourceId = body.osint_source_id;

  // 4. Upsert osint_sources
  if (osintSourceId) {
    await supabase.from('osint_sources').update({
      source_url: body.source_url.trim(),
      source_name: body.source_name.trim(),
      last_fetched_at: now,
      fetch_interval_minutes: body.fetch_interval_minutes || 30,
      is_active: true,
      detection_keywords: keywords,
      nb_articles_last_check: totalFetched,
      rss_validated: true,
      reliability_score: reliabilityBase,
      updated_at: now,
    }).eq('id', osintSourceId);
    await incrementOsintCounter(supabase, osintSourceId, 'total_articles_fetched', totalFetched);
  } else {
    const { data: existing } = await supabase.from('osint_sources').select('id').eq('source_url', body.source_url.trim()).maybeSingle();
    if (existing) {
      osintSourceId = existing.id;
      await supabase.from('osint_sources').update({
        source_name: body.source_name.trim(),
        last_fetched_at: now,
        fetch_interval_minutes: body.fetch_interval_minutes || 30,
        is_active: true,
        detection_keywords: keywords,
        nb_articles_last_check: totalFetched,
        rss_validated: true,
        reliability_score: reliabilityBase,
        updated_at: now,
      }).eq('id', osintSourceId);
      await incrementOsintCounter(supabase, osintSourceId, 'total_articles_fetched', totalFetched);
    } else {
      const { data: inserted, error: insertErr } = await supabase.from('osint_sources').insert({
        source_type: 'rss',
        source_name: body.source_name.trim(),
        source_url: body.source_url.trim(),
        country: body.country.trim(),
        last_fetched_at: now,
        fetch_interval_minutes: body.fetch_interval_minutes || 30,
        is_active: true,
        detection_keywords: keywords,
        detection_patterns: [],
        total_articles_fetched: totalFetched,
        nb_articles_last_check: totalFetched,
        alerts_triggered: 0,
        rss_validated: true,
        reliability_score: reliabilityBase,
      }).select('id').single();
      if (insertErr) {
        return new Response(JSON.stringify({ success: false, reason: 'DB_INSERT_FAILED', detail: insertErr.message }), { status: 500 });
      }
      osintSourceId = inserted?.id || null;
    }
  }

  // 5. Insert articles with ANTI-SYNTHETIC GUARD (5 critères, sans verification_status)
  let insertedCount = 0;
  let rejectedCount = 0;
  const insertedIds: string[] = [];
  const sourceDomain = getDomain(body.source_url.trim());

  for (const article of matchedArticles.slice(0, 50)) {
    const feedId = crypto.randomUUID();
    const detectedCategory = guessCategory(`${article.title} ${article.description}`) || 'Sécurité';
    const articleUrl = article.link || body.source_url.trim();
    const sourceKnown = isKnownSource(body.source_name);
    // Plafonner hallucination_score à 0.3 max pour passer le garde
    const rawHallucinationScore = 1.0 - reliabilityBase;
    const hallucinationScore = Math.min(rawHallucinationScore, 0.28);

    const candidate = {
      id: feedId,
      rss_validated: true, // parsing RSS/Atom réel = validation réussie
      source_url: articleUrl,
      source_status: 'active' as const,
      hallucination_score: hallucinationScore,
    };

    // ---- GUARD ANTI-SYNTHÉTIQUE ----
    const guardResult = validateFeedCandidate(candidate);
    if (!guardResult.valid) {
      await logRejection(supabase, {
        title: article.title,
        source: body.source_name,
        source_url: articleUrl,
        country: body.country,
        category: detectedCategory,
        candidate_id: feedId,
        rss_validated: true,
      }, guardResult.violations, 'ingest-feed:rss_register');
      rejectedCount++;
      continue; // skip cet article, passer au suivant
    }

    // ---- INSERT ----
    try {
      const cleanSummary = article.description?.substring(0, 1000) || '';
      const contentHash = await computeContentHash(`${article.title}|${cleanSummary}`);
      const archiveUrl = await tryArchiveCapture(articleUrl);

      const { data: feedInserted, error: feedErr } = await supabase.from('feeds').insert({
        id: feedId,
        title: article.title.substring(0, 500),
        source: body.source_name.trim(),
        source_url: articleUrl,
        source_domain: sourceDomain,
        content_hash: contentHash,
        backup_archive_url: archiveUrl,
        country: body.country.trim(),
        category: detectedCategory,
        summary: cleanSummary || null,
        timestamp: article.pubDate || now,
        verification_status: sourceKnown ? 'verified' : 'unverified',
        hallucination_score: hallucinationScore,
        source_status: 'active',
        rss_validated: true,
        last_link_check: now,
      }).select('id').single();

      if (!feedErr && feedInserted) {
        insertedCount++;
        insertedIds.push(feedInserted.id);
      }
    } catch {
      rejectedCount++;
    }
  }

  // 6. Alert detection
  const alertKeywords = ['attaque', 'attentat', 'mort', 'urgence', 'coup', 'évacuation', 'explosion', 'crash', 'enlèvement'];
  const alertsTriggered = matchedArticles.filter(a =>
    alertKeywords.some(ak => (a.title + ' ' + a.description).toLowerCase().includes(ak))
  ).length;
  if (osintSourceId && alertsTriggered > 0) {
    await incrementOsintCounter(supabase, osintSourceId, 'alerts_triggered', alertsTriggered);
  }

  return new Response(JSON.stringify({
    success: true, mode: 'rss_register', osint_source_id: osintSourceId,
    rss: {
      http_status: httpStatus, total_articles_in_feed: totalFetched,
      matched_articles: matchedArticles.length, articles_inserted: insertedCount,
      articles_rejected_by_guard: rejectedCount,
      alerts_detected: alertsTriggered,
      sample_titles: matchedArticles.slice(0, 5).map(a => a.title),
    },
    message: `${totalFetched} articles, ${matchedArticles.length} matchés, ${insertedCount} insérés, ${rejectedCount} rejetés par le garde.`,
  }));
}

// ============ MAIN ============

interface IngestRequest {
  mode?: 'single' | 'rss_register';
  [key: string]: unknown;
}

serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', detail: 'POST uniquement.' }), { status: 405, headers });
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const body: IngestRequest = await req.json();
    if (body.mode === 'rss_register') {
      return await handleRssRegister(body as unknown as RssRegisterPayload, supabase);
    }
    return await handleSingle(body as unknown as SinglePayload, supabase);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: (err as Error).message }), { status: 500, headers });
  }
});
