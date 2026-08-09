import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — refresh-coverage-gaps v2.0
// Mécanisme de rattrapage de couverture (audit 2026-08 section 4) :
// complète le cron sentiqs-rss-poll (33 sources enregistrées, sans
// priorisation géographique) en ciblant spécifiquement les pays sans
// donnée récente ou sans source du tout, avec une recherche élargie
// multi-langue (français/anglais/arabe/portugais selon pertinence).
//
// Ne remplace pas rss-poll : les articles insérés ici entrent avec
// verification_status='unverified' et source_status='unchecked', comme
// tout flux fraîchement ingéré — batch-verify-feeds les re-score ensuite
// normalement. Rate-limité et verrouillé (coverage_refresh_lock) pour ne
// jamais surcharger Google News ni tourner en double avec un autre run.
//
// v2.0 — architecture tir groupé / récolte différée via pg_net (RPC net_fetch_start
// / net_fetch_collect) :
//   1. fetch() direct depuis le runtime Deno vers news.google.com échoue
//      systématiquement (HTTP 503, constaté en test réel et cohérent avec
//      l'échec silencieux jamais résolu de resobuzz/fetch-mentions qui
//      utilise le même pattern) — Google bloque apparemment l'espace
//      d'adresses des Edge Functions. Les appels sortants passent donc par
//      pg_net (net.http_get), exécuté côté Postgres, qui aboutit de façon
//      fiable.
//   2. Attendre chaque requête pg_net une par une avant de lancer la
//      suivante s'est aussi révélé peu fiable : la latence par requête est
//      très variable (jusqu'à ~80s observés). On lance donc TOUTES les
//      requêtes d'un coup (retour immédiat de pg_net, sans attendre la
//      réponse), puis on récolte en bloc après une attente unique — un
//      retardataire ne bloque plus les autres.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Miroir de AFRICA_54 / COUNTRY_CODES (src/hooks/useAlertLevels.ts) + langues
// pertinentes pour la recherche (base + arabe pour le Maghreb/Sahel/Corne de
// l'Afrique, portugais pour les pays lusophones).
const COUNTRY_LANGS: Record<string, { code: string; langs: string[] }> = {
  'Afrique du Sud': { code: 'ZA', langs: ['en'] },
  'Algérie': { code: 'DZ', langs: ['fr', 'ar'] },
  'Angola': { code: 'AO', langs: ['pt'] },
  'Bénin': { code: 'BJ', langs: ['fr'] },
  'Botswana': { code: 'BW', langs: ['en'] },
  'Burkina Faso': { code: 'BF', langs: ['fr'] },
  'Burundi': { code: 'BI', langs: ['fr', 'en'] },
  'Cameroun': { code: 'CM', langs: ['fr', 'en'] },
  'Cap-Vert': { code: 'CV', langs: ['pt'] },
  'Centrafrique': { code: 'CF', langs: ['fr'] },
  'Comores': { code: 'KM', langs: ['fr', 'ar'] },
  'Congo': { code: 'CG', langs: ['fr'] },
  "Côte d'Ivoire": { code: 'CI', langs: ['fr'] },
  'Djibouti': { code: 'DJ', langs: ['fr', 'ar'] },
  'Égypte': { code: 'EG', langs: ['ar', 'en'] },
  'Érythrée': { code: 'ER', langs: ['en'] },
  'Éthiopie': { code: 'ET', langs: ['en'] },
  'Gabon': { code: 'GA', langs: ['fr'] },
  'Gambie': { code: 'GM', langs: ['en'] },
  'Ghana': { code: 'GH', langs: ['en'] },
  'Guinée': { code: 'GN', langs: ['fr'] },
  'Guinée-Bissau': { code: 'GW', langs: ['pt'] },
  'Guinée Équatoriale': { code: 'GQ', langs: ['fr', 'en'] },
  'Kenya': { code: 'KE', langs: ['en'] },
  'Lesotho': { code: 'LS', langs: ['en'] },
  'Libéria': { code: 'LR', langs: ['en'] },
  'Libye': { code: 'LY', langs: ['ar'] },
  'Madagascar': { code: 'MG', langs: ['fr'] },
  'Malawi': { code: 'MW', langs: ['en'] },
  'Mali': { code: 'ML', langs: ['fr'] },
  'Maroc': { code: 'MA', langs: ['fr', 'ar'] },
  'Maurice': { code: 'MU', langs: ['fr', 'en'] },
  'Mauritanie': { code: 'MR', langs: ['ar', 'fr'] },
  'Mozambique': { code: 'MZ', langs: ['pt'] },
  'Namibie': { code: 'NA', langs: ['en'] },
  'Niger': { code: 'NE', langs: ['fr'] },
  'Nigeria': { code: 'NG', langs: ['en'] },
  'Ouganda': { code: 'UG', langs: ['en'] },
  'RDC': { code: 'CD', langs: ['fr'] },
  'Rwanda': { code: 'RW', langs: ['fr', 'en'] },
  'Sao Tomé-et-Principe': { code: 'ST', langs: ['pt'] },
  'Sénégal': { code: 'SN', langs: ['fr'] },
  'Seychelles': { code: 'SC', langs: ['fr', 'en'] },
  'Sierra Leone': { code: 'SL', langs: ['en'] },
  'Somalie': { code: 'SO', langs: ['ar', 'en'] },
  'Soudan': { code: 'SD', langs: ['ar', 'en'] },
  'Soudan du Sud': { code: 'SS', langs: ['en'] },
  'Éswatini': { code: 'SZ', langs: ['en'] },
  'Tanzanie': { code: 'TZ', langs: ['en'] },
  'Tchad': { code: 'TD', langs: ['fr', 'ar'] },
  'Togo': { code: 'TG', langs: ['fr'] },
  'Tunisie': { code: 'TN', langs: ['fr', 'ar'] },
  'Zambie': { code: 'ZM', langs: ['en'] },
  'Zimbabwe': { code: 'ZW', langs: ['en'] },
};

// Limites pour ne jamais surcharger Google News ni faire déraper la durée
// d'exécution d'un run. MAX_COUNTRIES_PER_RUN réduit de 8 à 5 le 2026-08-09
// pour alléger la charge sur la file pg_net (voir note ci-dessous) — moins
// de requêtes en vol par run, donc une récolte plus rapide.
const MAX_COUNTRIES_PER_RUN = 5;
const MAX_LANGS_PER_COUNTRY = 2;
const FETCH_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_FIRES_MS = 300;
// Testé en réel le 2026-08-09 (plusieurs runs successifs, avec logs de
// diagnostic confirmant qu'il ne s'agit PAS d'une erreur RPC mais bien d'une
// absence de réponse dans net._http_response au moment de la requête) : le
// worker pg_net vide sa file par cycle (toutes les réponses d'un run
// arrivent groupées au même instant), avec une latence observée croissant
// de ~34s à >100s au fil de tests rapprochés — cohérent avec un effet de
// file d'attente qui s'alourdit sous charge de test répétée, plutôt qu'une
// latence intrinsèque au endpoint. Les Edge Functions Supabase ont un délai
// de réponse maximal strict de 150s (au-delà : 504 côté appelant), donc le
// budget ci-dessous vise ~140s au pire (tir + 3 passes de récolte), en
// restant sous ce plafond avec une marge de sécurité pour l'écriture finale
// en base.
const FIRST_COLLECT_WAIT_MS = 60000;
const SECOND_COLLECT_WAIT_MS = 40000;
const THIRD_COLLECT_WAIT_MS = 35000;
const STALE_LOCK_MINUTES = 20;
const STALE_DATA_THRESHOLD_HOURS = 48;
// Google News répond 503 à un client dont le User-Agent ne ressemble pas à
// un navigateur — sans effet ici puisqu'on passe par pg_net, mais conservé
// par prudence si Google applique la même heuristique côté IP Postgres un jour.
const NEWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface RssArticle {
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

function parseRssItems(xml: string): RssArticle[] {
  const items: RssArticle[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    if (title && link) items.push({ title, link, description, pubDate: pubDate || null });
  }
  return items.slice(0, 20);
}

// Catégorisation par mots-clés français uniquement — appliquée seulement au
// français pour éviter de deviner une catégorie sur un texte dans une langue
// non analysée ici (arabe, portugais, anglais) : mieux vaut laisser
// `category` vide qu'inventer un classement non vérifiable.
function guessCategoryFr(text: string): string | null {
  const lower = text.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/attaque|attentat|combat|affrontement|militaire|armée|rebelle|djihadiste|terroriste/i, 'Sécurité'],
    [/président|élection|gouvernement|ministre|parlement|opposition|constitution/i, 'Politique'],
    [/croissance|pib|inflation|dette|investissement|commerce|budget|fmi/i, 'Économie'],
    [/épidémie|virus|maladie|vaccin|hôpital|santé/i, 'Santé'],
    [/inondation|sécheresse|cyclone|climat|environnement/i, 'Environnement'],
    [/grève|manifestation|protestation|société civile/i, 'Social'],
    [/réfugié|déplacé|humanitaire|famine|aide/i, 'Humanitaire'],
  ];
  for (const [regex, cat] of map) {
    if (regex.test(lower)) return cat;
  }
  return null;
}

async function computeContentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getDomain(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGoogleNewsUrl(countryName: string, gl: string, hl: string): string {
  const query = encodeURIComponent(countryName);
  return `https://news.google.com/rss/search?q=${query}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
}

interface CountryGap {
  name: string;
  code: string;
  langs: string[];
  reason: 'sans_source' | 'donnees_anciennes' | 'jamais_collecte';
  lastFeedAt: string | null;
}

interface PendingFetch {
  requestId: number;
  countryCode: string;
  countryName: string;
  lang: string;
}

interface FetchResult {
  status_code: number | null;
  content: string | null;
  error_msg: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();

    // ---- Verrou dédié (indépendant de scan_schedule, workload différent) ----
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1000).toISOString();
    const { data: lockRows, error: lockError } = await supabase
      .from('coverage_refresh_lock')
      .update({ running: true, running_started_at: now.toISOString() })
      .eq('id', 1)
      .or(`running.eq.false,running_started_at.lt.${staleBefore}`)
      .select('id');

    if (lockError) throw lockError;

    if (!lockRows || lockRows.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Rattrapage déjà en cours (verrou actif).',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      // ---- 1. Identifier les pays en creux ----
      const staleCutoff = new Date(now.getTime() - STALE_DATA_THRESHOLD_HOURS * 3600 * 1000).toISOString();

      const [{ data: sourceCountries }, { data: latestFeeds }] = await Promise.all([
        supabase.from('osint_sources').select('country').eq('is_active', true),
        supabase.from('feeds').select('country, timestamp').order('timestamp', { ascending: false }).limit(4000),
      ]);

      const countriesWithSource = new Set((sourceCountries || []).map((s) => s.country).filter(Boolean));
      const latestFeedByCountry = new Map<string, string>();
      for (const f of latestFeeds || []) {
        if (!f.country) continue;
        if (!latestFeedByCountry.has(f.country)) latestFeedByCountry.set(f.country, f.timestamp);
      }

      const gaps: CountryGap[] = [];
      for (const [name, meta] of Object.entries(COUNTRY_LANGS)) {
        const lastFeedAt = latestFeedByCountry.get(name) || null;
        const hasSource = countriesWithSource.has(name);

        if (!hasSource) {
          gaps.push({ name, code: meta.code, langs: meta.langs, reason: 'sans_source', lastFeedAt });
        } else if (!lastFeedAt) {
          gaps.push({ name, code: meta.code, langs: meta.langs, reason: 'jamais_collecte', lastFeedAt });
        } else if (lastFeedAt < staleCutoff) {
          gaps.push({ name, code: meta.code, langs: meta.langs, reason: 'donnees_anciennes', lastFeedAt });
        }
      }

      // Priorité : jamais collecté / sans source d'abord, puis données les plus anciennes.
      gaps.sort((a, b) => {
        const rank = (g: CountryGap) => (g.reason === 'sans_source' ? 0 : g.reason === 'jamais_collecte' ? 1 : 2);
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.lastFeedAt || '').localeCompare(b.lastFeedAt || '');
      });

      const targets = gaps.slice(0, MAX_COUNTRIES_PER_RUN);

      // ---- 2. Phase de tir : lance toutes les requêtes pg_net d'un coup ----
      const pending: PendingFetch[] = [];
      for (const target of targets) {
        const langsToTry = target.langs.slice(0, MAX_LANGS_PER_COUNTRY);
        for (const lang of langsToTry) {
          await sleep(DELAY_BETWEEN_FIRES_MS);
          const url = buildGoogleNewsUrl(target.name, target.code, lang);
          const { data: requestId, error: startErr } = await supabase.rpc('net_fetch_start', {
            p_url: url,
            p_headers: { 'User-Agent': NEWS_USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
            p_timeout_ms: FETCH_TIMEOUT_MS,
          });
          if (!startErr && requestId != null) {
            pending.push({ requestId: requestId as number, countryCode: target.code, countryName: target.name, lang });
          }
        }
      }

      // ---- 3. Phase de récolte : une attente, puis récupération en bloc ----
      const results = new Map<number, FetchResult>();
      const debugLog: string[] = [];

      async function collectOnce(ids: number[]) {
        if (ids.length === 0) return;
        const { data, error } = await supabase.rpc('net_fetch_collect', { p_request_ids: ids });
        if (error) {
          debugLog.push(`collect error: ${JSON.stringify(error)}`);
          return;
        }
        if (!data) {
          debugLog.push('collect: no data');
          return;
        }
        debugLog.push(`collect: got ${(data as unknown[]).length} rows for ${ids.length} ids`);
        for (const row of data as Array<{ id: number; status_code: number | null; content: string | null; error_msg: string | null }>) {
          if (row.status_code != null || row.error_msg != null) {
            results.set(row.id, { status_code: row.status_code, content: row.content, error_msg: row.error_msg });
          }
        }
      }

      await sleep(FIRST_COLLECT_WAIT_MS);
      await collectOnce(pending.map((p) => p.requestId));

      let stragglers = pending.filter((p) => !results.has(p.requestId));
      if (stragglers.length > 0) {
        await sleep(SECOND_COLLECT_WAIT_MS);
        await collectOnce(stragglers.map((p) => p.requestId));
      }

      stragglers = pending.filter((p) => !results.has(p.requestId));
      if (stragglers.length > 0) {
        await sleep(THIRD_COLLECT_WAIT_MS);
        await collectOnce(stragglers.map((p) => p.requestId));
      }

      // ---- 4. Traitement des résultats, agrégés par pays ----
      const runLog: Array<Record<string, unknown>> = [];
      let totalInserted = 0;
      let totalFound = 0;

      for (const target of targets) {
        const attempts = pending.filter((p) => p.countryCode === target.code);
        let foundForCountry = 0;
        let insertedForCountry = 0;
        let lastError: string | null = null;

        for (const attempt of attempts) {
          const result = results.get(attempt.requestId);
          if (!result) {
            lastError = 'Pas de réponse dans le délai imparti';
            continue;
          }
          if (result.error_msg) {
            lastError = result.error_msg;
            continue;
          }
          if (result.status_code !== 200 || !result.content) {
            lastError = `HTTP ${result.status_code} (${attempt.lang})`;
            continue;
          }

          const articles = parseRssItems(result.content);
          foundForCountry += articles.length;

          for (const article of articles.slice(0, 8)) {
            const { data: existing } = await supabase
              .from('feeds')
              .select('id')
              .eq('source_url', article.link)
              .maybeSingle();
            if (existing) continue;

            const cleanTitle = article.title.substring(0, 500);
            const cleanSummary = article.description.substring(0, 1000);
            const category = attempt.lang === 'fr' ? guessCategoryFr(`${cleanTitle} ${cleanSummary}`) : null;
            const contentHash = await computeContentHash(`${cleanTitle}|${cleanSummary}`);

            const { error: insertErr } = await supabase.from('feeds').insert({
              id: crypto.randomUUID(),
              title: cleanTitle,
              source: `Google News (${attempt.lang})`,
              source_url: article.link,
              source_domain: getDomain(article.link),
              content_hash: contentHash,
              country: target.name,
              category,
              summary: cleanSummary || null,
              timestamp: article.pubDate ? new Date(article.pubDate).toISOString() : now.toISOString(),
              verification_status: 'unverified',
              // Provenance de rattrapage multi-langue, pas encore vérifiée individuellement —
              // score prudent, source_status='unchecked' pour que batch-verify-feeds la reprenne.
              hallucination_score: 0.3,
              source_status: 'unchecked',
              last_link_check: null,
              rss_validated: true,
            });

            if (!insertErr) {
              insertedForCountry++;
              totalInserted++;
            }
          }
        }

        totalFound += foundForCountry;

        const result = insertedForCountry > 0 ? 'couverture_amelioree' : lastError ? 'erreur' : 'aucun_resultat';
        runLog.push({
          run_at: now.toISOString(),
          country_code: target.code,
          country_name: target.name,
          languages_tried: attempts.map((a) => a.lang),
          sources_checked: attempts.length,
          articles_found: foundForCountry,
          articles_inserted: insertedForCountry,
          result,
          detail: lastError,
        });

        // ---- Met à jour la couverture persistée, SANS toucher level/score ----
        // Un UPDATE ciblé (pas un upsert) pour ne jamais écraser un niveau de risque
        // déjà calculé par useAlertLevels — seule la ligne réellement absente (pays
        // jamais coté) est créée, avec level='non_cote' (valeur prévue par le schéma
        // pour "pas encore coté", distincte de 'vert').
        const coverageStatus = insertedForCountry > 0 ? 'couverture_partielle' : target.reason === 'sans_source' ? 'source_indisponible' : 'aucune_donnee_recente';
        const { data: updatedRows } = await supabase
          .from('country_posture_state')
          .update({
            coverage_status: coverageStatus,
            last_collection_at: now.toISOString(),
            sources_consulted_count: attempts.length,
          })
          .eq('country_code', target.code)
          .select('country_code');

        if (!updatedRows || updatedRows.length === 0) {
          await supabase.from('country_posture_state').insert({
            country_code: target.code,
            country_name: target.name,
            level: 'non_cote',
            score: 0,
            coverage_status: coverageStatus,
            last_collection_at: now.toISOString(),
            sources_consulted_count: attempts.length,
          });
        }
      }

      if (runLog.length > 0) {
        await supabase.from('coverage_refresh_log').insert(runLog);
      }

      await supabase.from('coverage_refresh_lock').update({ last_run_at: now.toISOString() }).eq('id', 1);

      return new Response(JSON.stringify({
        success: true,
        run_at: now.toISOString(),
        requests_fired: pending.length,
        requests_answered: results.size,
        countries_targeted: targets.map((t) => ({ name: t.name, code: t.code, reason: t.reason })),
        countries_processed: runLog.length,
        total_countries_in_gap: gaps.length,
        total_articles_found: totalFound,
        total_articles_inserted: totalInserted,
        log: runLog,
        debug: debugLog,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } finally {
      await supabase.from('coverage_refresh_lock').update({ running: false }).eq('id', 1);
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
