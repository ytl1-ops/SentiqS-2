// ============================================================
// SentiqS — realDataGuard v1.0
// Définition centrale d'une donnée réelle vs synthétique.
// Point de référence unique pour tous les filtres et guards
// du pipeline d'ingestion et d'affichage.
// ============================================================

// ---------- SYNTHETIC ID PATTERNS ----------

/**
 * Patterns regex des IDs fabriqués (données mock / générées par IA).
 * Chaque pattern couvre une famille d'IDs synthétiques identifiée dans la base.
 *
 * Couverture :
 *   ^feed-\d+$        → feed-123, feed-456
 *   ^FLX-             → FLX-093, FLX-142
 *   ^[a-z]{2}-feed-   → sc-feed-3, km-feed-5, cv-feed-6, mu-feed-4, er-feed-1
 *   ^feed-rss-        → feed-rss-wa02, feed-rss-sn01
 *   -extra-           → cm-feed-extra-2, ng-feed-extra-1
 */
export const SYNTHETIC_ID_PATTERNS: RegExp[] = [
  /^feed-\d+$/,
  /^FLX-/,
  /^[a-z]{2}-feed-/,
  /^feed-rss-/,
  /-extra-/,
];

// ---------- TYPES ----------

/** Propriétés minimales requises pour valider un feed comme réellement ingéré. */
export interface RealFeedCandidate {
  id: string | number;
  rss_validated?: boolean | null;
  source_url?: string | null;
  source_status?: string | null;
  verification_status?: string | null;
  hallucination_score?: number | null;
}

/** Résultat de classification d'un feed. */
export interface FeedClassification {
  feedId: string | number;
  isReal: boolean;
  reasons: string[];
}

// ---------- ID VALIDATION ----------

/**
 * Vérifie si un ID correspond à un pattern synthétique connu.
 * Retourne true si l'ID est fabriqué.
 */
export function isSyntheticId(id: string | number): boolean {
  const str = String(id);
  return SYNTHETIC_ID_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Retourne le pattern qui a matché l'ID, ou null si aucun.
 * Utile pour le diagnostic / logging.
 */
export function getSyntheticIdPattern(id: string | number): RegExp | null {
  const str = String(id);
  return SYNTHETIC_ID_PATTERNS.find((pattern) => pattern.test(str)) ?? null;
}

// ---------- SOURCE URL VALIDATION ----------

/** Domaines de moteurs de recherche / agrégateurs — ne sont pas des articles. */
const NON_ARTICLE_DOMAINS = new Set([
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'search.yahoo.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
]);

/**
 * Vérifie qu'une URL est une vraie URL d'article :
 * - Protocole http ou https
 * - Chemin avec au moins un segment significatif au-delà de "/"
 * - Pas un moteur de recherche
 */
export function isArticleUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    // Rejeter les moteurs de recherche
    if (NON_ARTICLE_DOMAINS.has(parsed.hostname)) return false;

    // Le chemin doit avoir au moins un segment significatif
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') return false;

    // Au moins un segment de chemin qui n'est pas vide
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return false;

    return true;
  } catch {
    return false;
  }
}

// ---------- REAL FEED CLASSIFICATION ----------

/**
 * Critère unique et exhaustif définissant un feed réellement ingéré.
 *
 * Un feed est considéré RÉEL si et seulement si TOUTES les conditions
 * suivantes sont remplies :
 *
 * 1. rss_validated === true          — validé par le pipeline RSS
 * 2. ID non synthétique              — ne match aucun SYNTHETIC_ID_PATTERNS
 * 3. source_url = vraie URL article  — http(s) avec chemin, pas un moteur de recherche
 * 4. source_status != 'dead'         — la source est vivante
 * 5. verification_status ∈ {verified, confirmed}
 * 6. hallucination_score <= 0.3      — score de fiabilité acceptable
 */
export function isRealIngestedFeed(feed: RealFeedCandidate): boolean {
  return getRealFeedViolations(feed).length === 0;
}

/**
 * Retourne la liste des violations qui empêchent un feed d'être considéré réel.
 * Liste vide = feed réel.
 */
export function getRealFeedViolations(feed: RealFeedCandidate): string[] {
  const reasons: string[] = [];

  // 1. rss_validated
  if (feed.rss_validated !== true) {
    reasons.push('rss_validated !== true');
  }

  // 2. ID non synthétique
  if (isSyntheticId(feed.id)) {
    const pattern = getSyntheticIdPattern(feed.id);
    reasons.push(`ID synthétique (pattern: ${pattern?.source ?? 'inconnu'})`);
  }

  // 3. source_url article
  if (!isArticleUrl(feed.source_url)) {
    reasons.push(`source_url non article: ${feed.source_url ?? 'null'}`);
  }

  // 4. source_status
  if (feed.source_status === 'dead') {
    reasons.push('source_status = dead');
  }

  // 5. verification_status
  if (feed.verification_status !== 'verified' && feed.verification_status !== 'confirmed') {
    reasons.push(`verification_status = ${feed.verification_status ?? 'null'}`);
  }

  // 6. hallucination_score
  if (feed.hallucination_score === null || feed.hallucination_score === undefined) {
    reasons.push('hallucination_score manquant');
  } else if (feed.hallucination_score > 0.3) {
    reasons.push(`hallucination_score = ${feed.hallucination_score} (> 0.3)`);
  }

  return reasons;
}

// ---------- BATCH OPERATIONS ----------

/**
 * Filtre une liste pour ne garder que les feeds réels.
 */
export function filterRealFeeds<T extends RealFeedCandidate>(feeds: T[]): T[] {
  return feeds.filter((feed) => isRealIngestedFeed(feed));
}

/**
 * Compte les feeds synthétiques dans une liste.
 */
export function countSynthetic<T extends RealFeedCandidate>(feeds: T[]): number {
  return feeds.filter((feed) => isSyntheticId(feed.id)).length;
}

/**
 * Compte les feeds non-synthétiques mais qui échouent quand même
 * le test isRealIngestedFeed (ex: vrai ID mais rss_validated false).
 */
export function countNonSyntheticButUnreal<T extends RealFeedCandidate>(feeds: T[]): number {
  return feeds.filter((feed) => !isSyntheticId(feed.id) && !isRealIngestedFeed(feed)).length;
}

/**
 * Retourne un rapport de classification complet pour une liste de feeds.
 */
export function classifyFeeds<T extends RealFeedCandidate>(feeds: T[]): {
  total: number;
  real: number;
  synthetic: number;
  nonSyntheticButUnreal: number;
  details: FeedClassification[];
} {
  const details: FeedClassification[] = feeds.map((feed) => ({
    feedId: feed.id,
    isReal: isRealIngestedFeed(feed),
    reasons: getRealFeedViolations(feed),
  }));

  return {
    total: feeds.length,
    real: details.filter((d) => d.isReal).length,
    synthetic: details.filter((d) => d.reasons.some((r) => r.startsWith('ID synthétique'))).length,
    nonSyntheticButUnreal: details.filter(
      (d) => !d.isReal && !d.reasons.some((r) => r.startsWith('ID synthétique')),
    ).length,
    details,
  };
}

// ---------- GUARD HELPERS ----------

/**
 * Vérifie si un ID a l'air d'être un vrai ID de base de données
 * (numérique, positif, pas un pattern synthétique).
 */
export function looksLikeRealDbId(id: string | number): boolean {
  if (isSyntheticId(id)) return false;
  const str = String(id);
  // Un vrai ID DB est un entier positif
  return /^\d+$/.test(str) && parseInt(str, 10) > 0;
}