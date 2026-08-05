// ============================================================
// SentiqS — Vérifications d'intégrité runtime
// Validation anti-fuite de données mock en production
// ============================================================

import { isMockData, isVerifiedData, isReliableSource, computeHallucinationScore, validateSourceUrl } from '@/utils/dataIntegrity';
import type { HallucinationInput } from '@/utils/dataIntegrity';

// --- Types génériques pour la validation ---

interface ValidatableFeed {
  id: string | number;
  title?: string;
  source?: string;
  source_url?: string | null;
  source_status?: string | null;
  verification_status?: string | null;
  verified_at?: string | null;
  parent_feed_id?: string | null;
  timestamp?: string;
  hallucination_score?: number;
}

interface ValidatableAlert {
  id: string | number;
  title?: string;
  source?: string;
  source_url?: string | null;
  verification_status?: string | null;
  timestamp?: string;
}

interface IntegrityReport {
  passed: boolean;
  violations: IntegrityViolation[];
}

interface IntegrityViolation {
  type: 'mock_leak' | 'unfiltered_unverified' | 'missing_source_url' | 'inconsistent_hallucination_score';
  itemId: string | number;
  detail: string;
}

/**
 * Vérifie qu'aucune donnée mock ne fuit dans les résultats.
 */
export function validateFeedIntegrity(feeds: ValidatableFeed[]): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  for (const feed of feeds) {
    if (isMockData(feed as unknown as Record<string, unknown>)) {
      violations.push({
        type: 'mock_leak',
        itemId: feed.id,
        detail: `Le feed ${feed.id} ("${feed.title || 'sans titre'}") présente des signes de données fictives`,
      });
    }
  }

  if (violations.length > 0) {
    console.warn('[IntegrityCheck] Fuite de données mock détectée :', violations);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Vérifie que toutes les alertes ont des source_url valides.
 */
export function validateAlertSourceUrls(alerts: ValidatableAlert[]): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  for (const alert of alerts) {
    if (!alert.source_url || !validateSourceUrl(alert.source_url)) {
      violations.push({
        type: 'missing_source_url',
        itemId: alert.id,
        detail: `L'alerte ${alert.id} ("${alert.title || 'sans titre'}") n'a pas de source_url valide`,
      });
    }
  }

  if (violations.length > 0) {
    console.warn('[IntegrityCheck] Alertes sans source_url valide :', violations);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Vérifie la cohérence entre hallucination_score et les champs sources.
 * Le score doit être corrélé avec source_status et verification_status.
 */
export function validateHallucinationScores(feeds: ValidatableFeed[]): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  for (const feed of feeds) {
    const storedScore = feed.hallucination_score;
    if (storedScore === undefined || storedScore === null) continue;

    const computedScore = computeHallucinationScore({
      source_url: feed.source_url ?? null,
      source_status: (feed.source_status as HallucinationInput['source_status']) ?? null,
      verification_status: feed.verification_status || 'unverified',
      verified_at: feed.verified_at ?? null,
      parent_feed_id: feed.parent_feed_id ?? null,
    });

    const diff = Math.abs(storedScore - computedScore);
    // Tolérance de 0.2 — au-delà c'est suspect
    if (diff > 0.2) {
      violations.push({
        type: 'inconsistent_hallucination_score',
        itemId: feed.id,
        detail: `Feed ${feed.id} : score stocké=${storedScore}, score calculé=${computedScore} (diff=${diff.toFixed(2)})`,
      });
    }
  }

  if (violations.length > 0) {
    console.warn('[IntegrityCheck] Incohérences hallucination_score :', violations);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Vérifie que les feeds non vérifiés / rumeurs sont filtrés.
 */
export function validateVerificationFiltering(items: ValidatableFeed[]): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  for (const item of items) {
    if (!isVerifiedData({ verification_status: item.verification_status })) {
      if (!isReliableSource({ source_url: item.source_url ?? null, source_status: item.source_status })) {
        violations.push({
          type: 'unfiltered_unverified',
          itemId: item.id,
          detail: `L'élément ${item.id} est non vérifié ET a une source non fiable — il ne devrait pas apparaître comme un fait confirmé`,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.warn('[IntegrityCheck] Éléments non vérifiés non filtrés :', violations);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Exécute toutes les vérifications d'intégrité et log les violations.
 * À appeler périodiquement ou au chargement des données.
 */
export function runIntegrityCheck(feeds: ValidatableFeed[], alerts: ValidatableAlert[]): boolean {
  const feedIntegrity = validateFeedIntegrity(feeds);
  const alertSources = validateAlertSourceUrls(alerts);
  const hallucinationCoherence = validateHallucinationScores(feeds);
  const verificationFilter = validateVerificationFiltering(feeds);

  const allPassed =
    feedIntegrity.passed &&
    alertSources.passed &&
    hallucinationCoherence.passed &&
    verificationFilter.passed;

  if (!allPassed) {
    console.warn('[IntegrityCheck] ⚠️ Des violations d\'intégrité ont été détectées.');
  }

  return allPassed;
}

/**
 * Guard de production — log une erreur si des mocks sont utilisés hors dev.
 */
export function assertNoMockLeak(source: string, data: unknown[]): void {
  if (import.meta.env.PROD) {
    const mockItems = data.filter((item) =>
      isMockData(item as unknown as Record<string, unknown>)
    );
    if (mockItems.length > 0) {
      console.error(
        `[PROD-GUARD] ${source} : ${mockItems.length} élément(s) mock détecté(s) en production !`,
        mockItems
      );
    }
  }
}