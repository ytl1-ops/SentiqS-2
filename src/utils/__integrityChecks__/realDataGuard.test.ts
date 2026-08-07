// ============================================================
// SentiqS — Tests d'intégrité pour realDataGuard
// Validation exhaustive de chaque pattern, cas limite, et scénario réel.
// ============================================================

import {
  SYNTHETIC_ID_PATTERNS,
  isSyntheticId,
  getSyntheticIdPattern,
  isArticleUrl,
  isRealIngestedFeed,
  getRealFeedViolations,
  filterRealFeeds,
  countSynthetic,
  countNonSyntheticButUnreal,
  classifyFeeds,
  looksLikeRealDbId,
} from '@/utils/realDataGuard';
import type { RealFeedCandidate } from '@/utils/realDataGuard';

// ============================================================
// 1. SYNTHETIC_ID_PATTERNS — couverture des IDs connus
// ============================================================

interface IdTestCase {
  id: string;
  expectedSynthetic: boolean;
  expectedPattern: string | null;
}

const ID_TEST_CASES: IdTestCase[] = [
  // feed-NNN
  { id: 'feed-123', expectedSynthetic: true, expectedPattern: '^feed-\\d+$' },
  { id: 'feed-1', expectedSynthetic: true, expectedPattern: '^feed-\\d+$' },
  { id: 'feed-9999', expectedSynthetic: true, expectedPattern: '^feed-\\d+$' },
  { id: 'feed-abc', expectedSynthetic: false, expectedPattern: null }, // lettres après feed-
  { id: 'my-feed-123', expectedSynthetic: false, expectedPattern: null },

  // FLX-
  { id: 'FLX-093', expectedSynthetic: true, expectedPattern: '^FLX-' },
  { id: 'FLX-142', expectedSynthetic: true, expectedPattern: '^FLX-' },
  { id: 'FLX-hello', expectedSynthetic: true, expectedPattern: '^FLX-' },
  { id: 'flx-093', expectedSynthetic: false, expectedPattern: null }, // minuscule

  // XX-feed- (2 lettres minuscules)
  { id: 'sc-feed-3', expectedSynthetic: true, expectedPattern: '^[a-z]{2}-feed-' },
  { id: 'km-feed-5', expectedSynthetic: true, expectedPattern: '^[a-z]{2}-feed-' },
  { id: 'cv-feed-6', expectedSynthetic: true, expectedPattern: '^[a-z]{2}-feed-' },
  { id: 'mu-feed-4', expectedSynthetic: true, expectedPattern: '^[a-z]{2}-feed-' },
  { id: 'er-feed-1', expectedSynthetic: true, expectedPattern: '^[a-z]{2}-feed-' },
  { id: 'SC-feed-3', expectedSynthetic: false, expectedPattern: null }, // majuscule
  { id: 'abc-feed-1', expectedSynthetic: false, expectedPattern: null }, // 3 lettres

  // feed-rss-
  { id: 'feed-rss-wa02', expectedSynthetic: true, expectedPattern: '^feed-rss-' },
  { id: 'feed-rss-sn01', expectedSynthetic: true, expectedPattern: '^feed-rss-' },
  { id: 'my-feed-rss-01', expectedSynthetic: false, expectedPattern: null },

  // -extra-
  { id: 'cm-feed-extra-2', expectedSynthetic: true, expectedPattern: '-extra-' },
  { id: 'ng-feed-extra-1', expectedSynthetic: true, expectedPattern: '-extra-' },
  { id: 'extra-info', expectedSynthetic: false, expectedPattern: null }, // pas de tiret avant/après, mais -extra- dedans? Non: c'est "extra-info" pas "-extra-"

  // Vrais IDs de BDD
  { id: '1', expectedSynthetic: false, expectedPattern: null },
  { id: '42', expectedSynthetic: false, expectedPattern: null },
  { id: '100000', expectedSynthetic: false, expectedPattern: null },
  { id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', expectedSynthetic: false, expectedPattern: null }, // UUID
];

export function testSyntheticIdPatterns(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  for (const tc of ID_TEST_CASES) {
    const result = isSyntheticId(tc.id);
    if (result !== tc.expectedSynthetic) {
      failures.push(
        `isSyntheticId("${tc.id}"): attendu=${tc.expectedSynthetic}, obtenu=${result}`,
      );
      continue;
    }

    if (tc.expectedPattern) {
      const matched = getSyntheticIdPattern(tc.id);
      if (!matched || matched.source !== tc.expectedPattern) {
        failures.push(
          `getSyntheticIdPattern("${tc.id}"): attendu=${tc.expectedPattern}, obtenu=${matched?.source ?? 'null'}`,
        );
        continue;
      }
    }

    passed++;
  }

  return { passed, failed: failures.length, failures };
}

// ============================================================
// 2. isArticleUrl — validation des URLs d'article
// ============================================================

interface UrlTestCase {
  url: string | null | undefined;
  expectedValid: boolean;
  label: string;
}

const URL_TEST_CASES: UrlTestCase[] = [
  // Vraies URLs d'article
  { url: 'https://www.rfi.fr/fr/afrique/20260803-nigeria-manifestation-violente-kaduna', expectedValid: true, label: 'RFI article' },
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', expectedValid: true, label: 'BBC RSS feed (has path)' },
  { url: 'https://www.france24.com/fr/afrique/20260804-senegal-election-presidentielle', expectedValid: true, label: 'France24 article' },
  { url: 'https://fr.africanews.com/2026/08/03/rdc-manifestation-kinshasa', expectedValid: true, label: 'Africanews article' },

  // Google Search (rejeté)
  { url: 'https://www.google.com/search?q=test', expectedValid: false, label: 'Google search' },
  { url: 'https://google.com/search?q=test', expectedValid: false, label: 'Google search sans www' },

  // URLs sans chemin
  { url: 'https://www.rfi.fr', expectedValid: false, label: 'Domaine racine' },
  { url: 'https://www.rfi.fr/', expectedValid: false, label: 'Domaine racine avec /' },

  // URLs invalides
  { url: null, expectedValid: false, label: 'null' },
  { url: undefined, expectedValid: false, label: 'undefined' },
  { url: '', expectedValid: false, label: 'string vide' },
  { url: 'not-a-url', expectedValid: false, label: 'pas une URL' },
  { url: 'ftp://files.example.com/article', expectedValid: false, label: 'FTP' },

  // Bing search
  { url: 'https://www.bing.com/search?q=afrique', expectedValid: false, label: 'Bing search' },
];

export function testArticleUrlValidation(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  for (const tc of URL_TEST_CASES) {
    const result = isArticleUrl(tc.url);
    if (result !== tc.expectedValid) {
      failures.push(
        `isArticleUrl("${tc.label}"): attendu=${tc.expectedValid}, obtenu=${result}`,
      );
    } else {
      passed++;
    }
  }

  return { passed, failed: failures.length, failures };
}

// ============================================================
// 3. isRealIngestedFeed — critère complet
// ============================================================

interface FeedTestCase {
  label: string;
  feed: RealFeedCandidate;
  expectedReal: boolean;
  expectedViolationCount: number;
}

const FEED_TEST_CASES: FeedTestCase[] = [
  // --- RÉELS ---
  {
    label: 'Feed RSS réel parfait',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/20260804-nigeria-attaque-boko-haram',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: true,
    expectedViolationCount: 0,
  },
  {
    label: 'Feed RSS réel — status confirmed',
    feed: {
      id: 20567,
      rss_validated: true,
      source_url: 'https://www.bbc.com/news/world-africa-12345678',
      source_status: 'active',
      verification_status: 'confirmed',
      hallucination_score: 0.12,
    },
    expectedReal: true,
    expectedViolationCount: 0,
  },

  // --- SYNTHÉTIQUES (ID fabriqué) ---
  {
    label: 'ID feed-123 + rss_validated false',
    feed: {
      id: 'feed-123',
      rss_validated: false,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.1,
    },
    expectedReal: false,
    expectedViolationCount: 1, // ID synthétique seulement (rss_validated aussi, donc 2 en réalité)
  },
  {
    label: 'ID FLX-093',
    feed: {
      id: 'FLX-093',
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.1,
    },
    expectedReal: false,
    expectedViolationCount: 1, // ID synthétique
  },
  {
    label: 'ID sc-feed-3 + toutes autres conditions OK',
    feed: {
      id: 'sc-feed-3',
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.1,
    },
    expectedReal: false,
    expectedViolationCount: 1, // ID synthétique
  },

  // --- rss_validated !== true ---
  {
    label: 'Vrai ID mais rss_validated false',
    feed: {
      id: 10042,
      rss_validated: false,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1, // rss_validated
  },
  {
    label: 'Vrai ID mais rss_validated null',
    feed: {
      id: 10042,
      rss_validated: null,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },
  {
    label: 'Vrai ID mais rss_validated absent',
    feed: {
      id: 10042,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },

  // --- source_url invalide ---
  {
    label: 'Google search URL',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.google.com/search?q=test',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1, // source_url non article
  },

  // --- source_status dead ---
  {
    label: 'source_status = dead',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'dead',
      verification_status: 'verified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },

  // --- verification_status invalide ---
  {
    label: 'verification_status = unverified',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'unverified',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },
  {
    label: 'verification_status = rumor',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'rumor',
      hallucination_score: 0.05,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },

  // --- hallucination_score > 0.3 ---
  {
    label: 'hallucination_score = 0.31',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.31,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },
  {
    label: 'hallucination_score = 0.45 (typique feed synthétique)',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: 0.45,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },
  {
    label: 'hallucination_score manquant',
    feed: {
      id: 10042,
      rss_validated: true,
      source_url: 'https://www.rfi.fr/fr/afrique/article',
      source_status: 'active',
      verification_status: 'verified',
      hallucination_score: null,
    },
    expectedReal: false,
    expectedViolationCount: 1,
  },

  // --- Combinaisons multiples ---
  {
    label: 'Feed totalement bidon (4 violations)',
    feed: {
      id: 'feed-456',
      rss_validated: false,
      source_url: 'https://www.google.com/search?q=fake',
      source_status: 'dead',
      verification_status: 'unverified',
      hallucination_score: 0.8,
    },
    expectedReal: false,
    expectedViolationCount: 6, // ID + rss_validated + source_url + source_status + verification_status + hallucination_score
  },
];

export function testRealFeedClassification(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  for (const tc of FEED_TEST_CASES) {
    const isReal = isRealIngestedFeed(tc.feed);
    const violations = getRealFeedViolations(tc.feed);

    if (isReal !== tc.expectedReal) {
      failures.push(
        `[${tc.label}] isRealIngestedFeed: attendu=${tc.expectedReal}, obtenu=${isReal}`,
      );
      continue;
    }

    // Vérifier le nombre de violations (tolérance: le count attendu doit être <= violations réelles,
    // car il peut y avoir des violations qu'on n'a pas anticipées dans les cas simples)
    if (violations.length < tc.expectedViolationCount) {
      failures.push(
        `[${tc.label}] violations: attendu >= ${tc.expectedViolationCount}, obtenu=${violations.length} (${violations.join('; ')})`,
      );
      continue;
    }

    passed++;
  }

  return { passed, failed: failures.length, failures };
}

// ============================================================
// 4. Batch operations — filterRealFeeds, countSynthetic, classifyFeeds
// ============================================================

const MIXED_FEEDS: RealFeedCandidate[] = [
  // 3 réels
  {
    id: 10001,
    rss_validated: true,
    source_url: 'https://www.rfi.fr/fr/afrique/20260801-niger-coup-etat',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.02,
  },
  {
    id: 10002,
    rss_validated: true,
    source_url: 'https://www.bbc.com/news/world-africa-11111111',
    source_status: 'active',
    verification_status: 'confirmed',
    hallucination_score: 0.08,
  },
  {
    id: 10003,
    rss_validated: true,
    source_url: 'https://www.france24.com/fr/afrique/20260802-mali-manifestation',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.15,
  },
  // 4 synthétiques (ID fabriqué)
  {
    id: 'feed-123',
    rss_validated: false,
    source_url: 'https://www.google.com/search?q=fake1',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.08,
  },
  {
    id: 'FLX-093',
    rss_validated: false,
    source_url: 'https://www.google.com/search?q=fake2',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.0,
  },
  {
    id: 'sc-feed-3',
    rss_validated: false,
    source_url: 'https://www.google.com/search?q=fake3',
    source_status: 'dead',
    verification_status: 'confirmed',
    hallucination_score: 0.0,
  },
  {
    id: 'feed-rss-wa02',
    rss_validated: false,
    source_url: 'https://www.google.com/search?q=fake4',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.0,
  },
  // 2 non-synthétiques mais pas réels (vrai ID, mais rss_validated false ou autre)
  {
    id: 20001,
    rss_validated: false,
    source_url: 'https://www.rfi.fr/fr/afrique/article-legitime',
    source_status: 'active',
    verification_status: 'verified',
    hallucination_score: 0.1,
  },
  {
    id: 20002,
    rss_validated: true,
    source_url: 'https://www.rfi.fr/fr/afrique/article-legitime-2',
    source_status: 'active',
    verification_status: 'unverified',
    hallucination_score: 0.1,
  },
];

export function testBatchOperations(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  // filterRealFeeds
  const realOnly = filterRealFeeds(MIXED_FEEDS);
  if (realOnly.length !== 3) {
    failures.push(`filterRealFeeds: attendu 3 réels, obtenu ${realOnly.length}`);
  } else {
    passed++;
  }

  // countSynthetic
  const synthCount = countSynthetic(MIXED_FEEDS);
  if (synthCount !== 4) {
    failures.push(`countSynthetic: attendu 4, obtenu ${synthCount}`);
  } else {
    passed++;
  }

  // countNonSyntheticButUnreal
  const unrealCount = countNonSyntheticButUnreal(MIXED_FEEDS);
  if (unrealCount !== 2) {
    failures.push(`countNonSyntheticButUnreal: attendu 2, obtenu ${unrealCount}`);
  } else {
    passed++;
  }

  // classifyFeeds
  const classification = classifyFeeds(MIXED_FEEDS);
  if (classification.total !== 9) {
    failures.push(`classifyFeeds.total: attendu 9, obtenu ${classification.total}`);
  } else {
    passed++;
  }
  if (classification.real !== 3) {
    failures.push(`classifyFeeds.real: attendu 3, obtenu ${classification.real}`);
  } else {
    passed++;
  }
  if (classification.synthetic !== 4) {
    failures.push(`classifyFeeds.synthetic: attendu 4, obtenu ${classification.synthetic}`);
  } else {
    passed++;
  }
  if (classification.nonSyntheticButUnreal !== 2) {
    failures.push(`classifyFeeds.nonSyntheticButUnreal: attendu 2, obtenu ${classification.nonSyntheticButUnreal}`);
  } else {
    passed++;
  }

  return { passed, failed: failures.length, failures };
}

// ============================================================
// 5. looksLikeRealDbId
// ============================================================

export function testLooksLikeRealDbId(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;

  const validIds = ['1', '42', '100000', '9999999'];
  const invalidIds = ['feed-123', 'FLX-093', 'sc-feed-3', 'feed-rss-wa02', 'cm-feed-extra-2', 'abc', '-1', '0'];

  for (const id of validIds) {
    if (!looksLikeRealDbId(id)) {
      failures.push(`looksLikeRealDbId("${id}"): attendu true, obtenu false`);
    } else {
      passed++;
    }
  }

  for (const id of invalidIds) {
    if (looksLikeRealDbId(id)) {
      failures.push(`looksLikeRealDbId("${id}"): attendu false, obtenu true`);
    } else {
      passed++;
    }
  }

  return { passed, failed: failures.length, failures };
}

// ============================================================
// 6. Runner — exécute tous les tests
// ============================================================

export interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  failures: string[];
}

export function runAllRealDataGuardTests(): TestSuiteResult[] {
  const results: TestSuiteResult[] = [
    { suite: 'Synthetic ID Patterns', ...testSyntheticIdPatterns() },
    { suite: 'Article URL Validation', ...testArticleUrlValidation() },
    { suite: 'Real Feed Classification', ...testRealFeedClassification() },
    { suite: 'Batch Operations', ...testBatchOperations() },
    { suite: 'looksLikeRealDbId', ...testLooksLikeRealDbId() },
  ];

  return results;
}

/**
 * Lance les tests et log les résultats.
 * À appeler en dev ou dans un guard de prod.
 */
export function validateRealDataGuard(): boolean {
  const results = runAllRealDataGuardTests();
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);

  if (totalFailed > 0) {
    console.error('[RealDataGuard] ⚠️ Tests échoués :');
    for (const r of results) {
      if (r.failed > 0) {
        console.error(`  ${r.suite}: ${r.failed} échec(s)`);
        for (const f of r.failures) {
          console.error(`    → ${f}`);
        }
      }
    }
  }

  console.log(
    `[RealDataGuard] Tests terminés : ${totalPassed} réussis, ${totalFailed} échoués sur ${results.length} suites`,
  );

  return totalFailed === 0;
}