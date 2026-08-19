// ============================================================
// SentiqS — Module d'intégrité des données
// Vérification anti-hallucination : critères documentés et vérifiables
// ============================================================

/**
 * Niveaux de qualité des feeds RSS / alertes.
 * Documente les 3 paliers de fiabilité utilisés dans toute l'app.
 */
/**
 * Niveaux de qualité alignés avec verify-feed v3.0.
 * verified: score < 0.30 | unverified: 0.30-0.60 | rumor: > 0.60
 */
export const FEED_QUALITY_TIERS = {
  /** Données vérifiées : score < 0.30 — ≥2 sources indépendantes ou source officielle, lien actif */
  RELIABLE: {
    label: 'Fiable',
    maxScore: 0.3,
    description: 'Source active et crédible, donnée corroborée (≥2 sources ou institutionnelle)',
  },
  /** Données non vérifiées : score 0.30-0.60 — 1 source ou source non recoupée, lien joignable */
  NEEDS_VERIFICATION: {
    label: 'À vérifier',
    maxScore: 0.6,
    description: 'Source joignable mais donnée non corroborée ou source unique',
  },
  /** Rumeur : score > 0.60 — source morte, pas de corroboration, source inconnue */
  UNRELIABLE: {
    label: 'Non fiable',
    maxScore: 1.0,
    description: 'Rumeur, source morte, absence de corroboration, ou source inconnue',
  },
} as const;

export interface HallucinationInput {
  source_url: string | null;
  source_status?: 'active' | 'warning' | 'dead' | 'unchecked' | null;
  verification_status: 'verified' | 'confirmed' | 'unverified' | 'rumor' | string;
  verified_at?: string | null;
  parent_feed_id?: string | null;
  /** Indique si l'élément a été corroboré par au moins une autre source indépendante */
  has_corroboration?: boolean;
}

/**
 * Calcule un score d'hallucination de 0 (parfaitement fiable) à 1 (totalement non fiable).
 *
 * Aligné avec verify-feed v3.0. Utilise les champs déjà renseignés par l'edge function.
 *
 * Critères documentés (4 axes) :
 *
 * 1. SOURCE_URL ET VIVACITÉ (poids max 0.35)
 *    - Pas de source_url ou source_status = 'dead' → +0.35
 *    - source_status = 'warning' → +0.20
 *    - source_status = 'unchecked' → +0.12
 *    - source_status = 'active' → pas de pénalité
 *
 * 2. STATUT DE VÉRIFICATION (poids max 0.50)
 *    - verification_status = 'rumor' → +0.50
 *    - verification_status = 'unverified' → +0.25
 *    - verification_status = 'verified' ou 'confirmed' → pas de pénalité
 *
 * 3. FRAÎCHEUR DE verified_at (poids max 0.08)
 *    - Pas de verified_at → +0.08
 *    - verified_at > 7 jours → +0.08
 *    - verified_at entre 3 et 7 jours → +0.04
 *
 * 4. BONUS CORROBORATION (réduction max 0.15)
 *    - parent_feed_id présent (déduplication) ou has_corroboration → −0.15
 *
 * Seuils : verified < 0.30 | unverified 0.30-0.60 | rumor > 0.60
 */
export function computeHallucinationScore(input: HallucinationInput): number {
  let score = 0;
  const now = Date.now();

  // --- Critère 1 : source_url et vivacité (max 0.35) ---
  if (!input.source_url || !validateSourceUrl(input.source_url)) {
    score += 0.35;
  } else if (input.source_status === 'dead') {
    score += 0.35;
  } else if (input.source_status === 'warning') {
    score += 0.20;
  } else if (input.source_status === 'unchecked') {
    score += 0.12;
  }

  // --- Critère 2 : statut de vérification ---
  if (input.verification_status === 'rumor') {
    score += 0.5;
  } else if (input.verification_status === 'unverified') {
    score += 0.25;
  }

  // --- Critère 3 : fraîcheur de verified_at ---
  if (!input.verified_at) {
    score += 0.08;
  } else {
    const ageHours = (now - new Date(input.verified_at).getTime()) / 3_600_000;
    if (ageHours > 168) {
      score += 0.08;
    } else if (ageHours > 72) {
      score += 0.04;
    }
  }

  // --- Bonus corroboration ---
  if (input.parent_feed_id || input.has_corroboration) {
    score = Math.max(0, score - 0.15);
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * Vérifie qu'un feed a une source_url valide ET un source_status != 'dead'.
 */
export function isReliableSource(feed: {
  source_url: string | null;
  source_status?: string | null;
}): boolean {
  if (!feed.source_url || !validateSourceUrl(feed.source_url)) return false;
  if (feed.source_status === 'dead') return false;
  return true;
}

/**
 * Vérifie que verification_status ∈ {verified, confirmed}.
 */
export function isVerifiedData(item: {
  verification_status?: string | null;
}): boolean {
  return item.verification_status === 'verified' || item.verification_status === 'confirmed';
}

/**
 * Détecte les données mock (pattern d'IDs, champs vides suspects).
 * Retourne true si l'élément présente des signes de données fictives.
 */
export function isMockData(item: Record<string, unknown>): boolean {
  if (!item || typeof item !== 'object') return false;

  const id = item.id;
  // IDs numériques inférieurs à 1000 et positifs sont suspects
  if (typeof id === 'number' && id > 0 && id < 1000) return true;

  // Tableaux vides suspects dans des champs qui devraient être peuplés
  const suspectEmptyArrays = ['alerts', 'feeds', 'correlations', 'countries'];
  for (const key of suspectEmptyArrays) {
    if (Array.isArray(item[key]) && (item[key] as unknown[]).length === 0) return true;
  }

  // Champs obligatoires absents
  const requiredFields = ['id', 'title', 'timestamp', 'source'];
  const missingRequired = requiredFields.filter(
    (f) => item[f] === undefined || item[f] === null || item[f] === ''
  );
  if (missingRequired.length >= 2) return true;

  return false;
}

/**
 * Valide qu'une URL est syntaxiquement correcte.
 */
export function validateSourceUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Retourne le tier de qualité correspondant au score d'hallucination.
 */
export function getQualityTier(score: number): (typeof FEED_QUALITY_TIERS)[keyof typeof FEED_QUALITY_TIERS] {
  if (score <= FEED_QUALITY_TIERS.RELIABLE.maxScore) return FEED_QUALITY_TIERS.RELIABLE;
  if (score <= FEED_QUALITY_TIERS.NEEDS_VERIFICATION.maxScore) return FEED_QUALITY_TIERS.NEEDS_VERIFICATION;
  return FEED_QUALITY_TIERS.UNRELIABLE;
}