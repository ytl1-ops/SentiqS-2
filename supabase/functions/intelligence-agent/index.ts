import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ============================================================
// FILTRE SERVEUR — realDataGuard porté en Deno (4 critères)
// Appliqué AVANT tout appel au modèle et avant toute génération.
// ============================================================

const SYNTHETIC_ID_PATTERNS: RegExp[] = [
  /^feed-\d+$/,
  /^FLX-/,
  /^[a-z]{2}-feed-/,
  /^feed-rss-/,
  /-extra-/,
];

const NON_ARTICLE_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'bing.com', 'www.bing.com',
  'search.yahoo.com',
  'duckduckgo.com', 'www.duckduckgo.com',
]);

function isSyntheticId(id: string | number): boolean {
  const str = String(id);
  return SYNTHETIC_ID_PATTERNS.some((p) => p.test(str));
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
  } catch { return false; }
}

// ============================================================
// TYPES
// ============================================================

interface SynthesisRequest {
  type?: 'daily_briefing' | 'weekly_report' | 'ad_hoc' | 'threat_assessment' | 'situational_update';
  countries?: string[];
  categories?: string[];
  timeRange?: '24h' | '7d' | '30d' | 'custom';
  timeStart?: string;
  timeEnd?: string;
  language?: 'fr' | 'en';
  query?: string;
  maxFeeds?: number;
}

interface RawFeed {
  id: string;
  title: string;
  title_en?: string;
  source: string;
  source_url: string | null;
  timestamp: string;
  category: string;
  country: string;
  department?: string;
  locality?: string;
  verification_status: string;
  hallucination_score: number;
  source_status: string;
  summary?: string;
  translated_title?: string;
  translated_summary?: string;
}
// ============================================================
// FILTRE PRINCIPAL — 4 critères pour transmission au modèle
// ============================================================

interface FilterReport {
  total_fetched: number;
  passed: RawFeed[];
  rejected_synthetic_id: RawFeed[];
  rejected_bad_url: RawFeed[];
  rejected_dead_source: RawFeed[];
  rejected_high_hallucination: RawFeed[];
  verified: RawFeed[];
  unverified: RawFeed[];
}

function filterFeedsForModel(feeds: RawFeed[]): FilterReport {
  const rejected_synthetic_id: RawFeed[] = [];
  const rejected_bad_url: RawFeed[] = [];
  const rejected_dead_source: RawFeed[] = [];
  const rejected_high_hallucination: RawFeed[] = [];
  const passed: RawFeed[] = [];

  for (const f of feeds) {
    // Critère 1 : ID non synthétique
    if (isSyntheticId(f.id)) {
      rejected_synthetic_id.push(f);
      continue;
    }
    // Critère 2 : source_url = vraie URL article http(s)
    if (!isArticleUrl(f.source_url)) {
      rejected_bad_url.push(f);
      continue;
    }
    // Critère 3 : source_status != 'dead'
    if (f.source_status === 'dead') {
      rejected_dead_source.push(f);
      continue;
    }
    // Critère 4 : hallucination_score <= 0.3
    if (f.hallucination_score === null || f.hallucination_score === undefined || f.hallucination_score > 0.3) {
      rejected_high_hallucination.push(f);
      continue;
    }
    passed.push(f);
  }

  return {
    total_fetched: feeds.length,
    passed,
    rejected_synthetic_id,
    rejected_bad_url,
    rejected_dead_source,
    rejected_high_hallucination,
    verified: passed.filter((f) => f.verification_status === 'verified' || f.verification_status === 'confirmed'),
    unverified: passed.filter((f) => f.verification_status !== 'verified' && f.verification_status !== 'confirmed'),
  };
}

// ============================================================
// VÉRIFICATION POST-GÉNÉRATION
// ============================================================

function buildGroundTruth(feeds: RawFeed[]): Set<string> {
  const terms = new Set<string>();
  const stopWords = new Set([
    'the', 'and', 'for', 'from', 'with', 'that', 'this', 'have', 'been',
    'est', 'les', 'des', 'une', 'dans', 'par', 'sur', 'pour', 'avec',
    'pas', 'plus', 'aux', 'son', 'ses', 'qui', 'que', 'sont', 'ont',
    'après', 'après', 'deux', 'trois', 'fait', 'être', 'elle', 'nous',
    'vous', 'leur', 'leurs', 'dont', 'entre', 'comme', 'mais', 'tout',
    'tous', 'aussi', 'très', 'bien', 'peut', 'faire', 'cette', 'ces',
    'sous', 'alors', 'donc', 'autre', 'autres', 'même', 'cela',
  ]);

  for (const f of feeds) {
    const text = [
      f.title, f.title_en, f.summary, f.translated_title,
      f.translated_summary, f.source, f.country, f.locality,
      f.department,
    ].filter(Boolean).join(' ');

    // Extraire tous les mots significatifs
    const words = text.split(/[\s,.;:!?()\[\]"'«»\-\u2013\u2014\u2018\u2019\u201c\u201d\/\\]+/);
    for (const w of words) {
      const cleaned = w.toLowerCase().trim();
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        terms.add(cleaned);
      }
    }

    // Ajouter l'URL complète et le domaine
    if (f.source_url) {
      terms.add(f.source_url.toLowerCase());
      try {
        const host = new URL(f.source_url).hostname.toLowerCase();
        terms.add(host);
      } catch { /* ignore */ }
    }

    // Extraire les nombres
    const numbers = text.match(/\d+/g);
    if (numbers) {
      for (const n of numbers) terms.add(n);
    }
  }

  return terms;
}

function verifyOutputAgainstFeeds(output: string, groundTruth: Set<string>): string[] {
  const warnings: string[] = [];

  // Extraire les noms propres potentiels (mots capitalisés > 3 lettres)
  const properNouns = new Set<string>();
  const properRegex = /\b([A-ZÀ-Ü][a-zà-ü]{3,}(?:\s[A-ZÀ-Ü][a-zà-ü]{1,}){0,2})\b/g;
  let match;
  while ((match = properRegex.exec(output)) !== null) {
    properNouns.add(match[1]);
  }

  // Extraire les nombres significatifs (≥ 10, pour éviter les faux positifs type dates)
  const significantNumbers = new Set<string>();
  const numRegex = /\b(\d{2,})\b/g;
  while ((match = numRegex.exec(output)) !== null) {
    const num = parseInt(match[1], 10);
    if (num >= 10 && num <= 999999) {
      significantNumbers.add(match[1]);
    }
  }

  // Vérifier les noms propres
  const unknownNouns: string[] = [];
  for (const noun of properNouns) {
    const lower = noun.toLowerCase();
    // Vérifier si un des mots du nom propre est dans la ground truth
    const parts = lower.split(/\s+/);
    const anyPartFound = parts.some((p) => groundTruth.has(p));
    const wholeFound = groundTruth.has(lower);

    if (!anyPartFound && !wholeFound) {
      // Vérifier aussi si c'est un acronyme connu (toutes majuscules)
      if (!/^[A-Z]{2,6}$/.test(noun)) {
        unknownNouns.push(noun);
      }
    }
  }

  // Vérifier les nombres significatifs
  const unknownNumbers: string[] = [];
  for (const num of significantNumbers) {
    if (!groundTruth.has(num)) {
      unknownNumbers.push(num);
    }
  }

  if (unknownNouns.length > 0) {
    warnings.push(
      `[⚠ POST-VÉRIFICATION] Noms/lieux non retrouvés dans les sources fournies : ${unknownNouns.slice(0, 8).join(', ')}` +
      (unknownNouns.length > 8 ? ` (+${unknownNouns.length - 8} autres)` : '') +
      `. Ces mentions pourraient être des extrapolations du modèle.`
    );
  }

  if (unknownNumbers.length > 0) {
    warnings.push(
      `[⚠ POST-VÉRIFICATION] Chiffres non retrouvés dans les sources fournies : ${unknownNumbers.slice(0, 6).join(', ')}` +
      (unknownNumbers.length > 6 ? ` (+${unknownNumbers.length - 6} autres)` : '') +
      `. Vérifier manuellement.`
    );
  }

  return warnings;
}

// ============================================================
// SERVEUR PRINCIPAL
// ============================================================

serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const body: SynthesisRequest = await req.json();
    const language = body.language || 'fr';
    const synthesisType = body.type || 'ad_hoc';
    const maxFeeds = body.maxFeeds || 60;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Fetch feeds (ne filtre PAS par verification_status pour laisser passer les unverified) ---
    let timeFilter: string;
    switch (body.timeRange) {
      case '24h': timeFilter = '24 hours'; break;
      case '7d': timeFilter = '7 days'; break;
      case '30d': timeFilter = '30 days'; break;
      case 'custom':
        timeFilter = body.timeStart && body.timeEnd
          ? `between ${body.timeStart} and ${body.timeEnd}`
          : '7 days';
        break;
      default: timeFilter = '7 days';
    }

    let query = supabase
      .from('feeds')
      .select('*')
      .lte('hallucination_score', 0.30)
      .neq('source_status', 'dead')
      .not('source_url', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(maxFeeds);

    if (body.countries && body.countries.length > 0) {
      query = query.in('country', body.countries);
    }

    if (body.categories && body.categories.length > 0) {
      query = query.in('category', body.categories);
    }

    const { data: rawFeeds, error: fetchError } = await query;

    if (fetchError) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch feeds',
        detail: fetchError.message,
      }), { status: 500, headers });
    }

    // --- 2. Appliquer le filtre serveur strict (4 critères) ---
    const filterReport = filterFeedsForModel((rawFeeds || []) as RawFeed[]);

    // --- 3. Si aucun feed ne passe le filtre, retour explicite ---
    if (filterReport.passed.length === 0) {
      const reasonBreakdown = [
        filterReport.rejected_synthetic_id.length > 0
          ? `${filterReport.rejected_synthetic_id.length} IDs synthétiques`
          : null,
        filterReport.rejected_bad_url.length > 0
          ? `${filterReport.rejected_bad_url.length} URLs non-articles`
          : null,
        filterReport.rejected_dead_source.length > 0
          ? `${filterReport.rejected_dead_source.length} sources mortes`
          : null,
        filterReport.rejected_high_hallucination.length > 0
          ? `${filterReport.rejected_high_hallucination.length} scores hallucination > 0.3`
          : null,
      ].filter(Boolean).join(', ');

      const countryMsg = body.countries?.length
        ? `pour ${body.countries.join(', ')}`
        : 'pour la zone surveillée';

      return new Response(JSON.stringify({
        success: true,
        empty: true,
        message: language === 'en'
          ? `No verified data available for this period ${countryMsg}.`
          : `Aucune donnée vérifiée disponible pour cette période ${countryMsg}.`,
        detail: language === 'en'
          ? `${filterReport.total_fetched} feeds fetched from database, 0 passed the server-side filter (${reasonBreakdown || 'no feeds in database'}).`
          : `${filterReport.total_fetched} flux récupérés de la base, 0 ont passé le filtre serveur (${reasonBreakdown || 'aucun flux en base'}).`,
        filter_stats: {
          total_fetched: filterReport.total_fetched,
          passed: 0,
          rejected_synthetic_id: filterReport.rejected_synthetic_id.length,
          rejected_bad_url: filterReport.rejected_bad_url.length,
          rejected_dead_source: filterReport.rejected_dead_source.length,
          rejected_high_hallucination: filterReport.rejected_high_hallucination.length,
        },
      }), { headers });
    }

    // --- 4. Construire la ground truth pour la post-vérification ---
    const groundTruth = buildGroundTruth(filterReport.passed);

    // --- 5. Formater les feeds pour Claude avec distinction verified/unverified ---
    const formatFeed = (f: RawFeed, i: number, isVerified: boolean): string => {
      const title = language === 'en' ? (f.translated_title || f.title_en || f.title) : f.title;
      const summary = language === 'en' ? (f.translated_summary || f.summary || '') : (f.summary || '');
      const verifLabel = isVerified
        ? (f.verification_status === 'confirmed' ? 'CONFIRMÉ (fait établi)' : 'VÉRIFIÉ (fait établi)')
        : 'NON CONFIRMÉ (information à traiter avec prudence)';
      const reliabilityScore = (1 - f.hallucination_score).toFixed(2);

      return `[${i + 1}] SOURCE: ${f.source} | PAYS: ${f.country || 'N/A'} | CATÉGORIE: ${f.category || 'N/A'} | DATE: ${f.timestamp}
STATUT FIABILITÉ: ${verifLabel} | SCORE: ${reliabilityScore}
TITRE: ${title}${summary ? `\nRÉSUMÉ: ${summary}` : ''}
URL: ${f.source_url || 'N/A'}`;
    };

    // Verified d'abord, puis unverified — avec séparation claire
    const verifiedBlocks = filterReport.verified.map((f, i) => formatFeed(f, i, true));
    const unverifiedBlocks = filterReport.unverified.map((f, i) => formatFeed(f, i + filterReport.verified.length, false));

    let feedsText = '';
    if (verifiedBlocks.length > 0) {
      feedsText += '═══════════════════════════════════════\n';
      feedsText += '═══ FAITS ÉTABLIS (sources corroborées) ═══\n';
      feedsText += '═══════════════════════════════════════\n\n';
      feedsText += verifiedBlocks.join('\n\n---\n\n');
    }

    if (unverifiedBlocks.length > 0) {
      if (feedsText.length > 0) {
        feedsText += '\n\n═══════════════════════════════════════\n';
        feedsText += '═══ INFORMATIONS NON CONFIRMÉES (une seule source, à traiter avec prudence) ═══\n';
        feedsText += '═══════════════════════════════════════\n\n';
      }
      feedsText += unverifiedBlocks.join('\n\n---\n\n');
    }

    // --- 6. Construire le system prompt ---
    const countryList = body.countries?.length ? body.countries.join(', ') : 'tous les pays africains concernés';
    const categoryList = body.categories?.length ? body.categories.join(', ') : 'toutes catégories';

    const typeLabels: Record<string, string> = {
      daily_briefing: 'Briefing Quotidien',
      weekly_report: 'Rapport Hebdomadaire',
      ad_hoc: 'Analyse Ponctuelle',
      threat_assessment: 'Évaluation de Menace',
      situational_update: 'Point de Situation',
    };

    // Note sur les feeds non confirmés à inclure dans le prompt
    const unverifiedNote = filterReport.unverified.length > 0
      ? `\n\n⚠️ IMPORTANT : ${filterReport.unverified.length} flux ci-dessus sont marqués "NON CONFIRMÉ". Ces informations proviennent d'une source unique non recoupée. Tu DOIS les présenter explicitement comme non confirmées, avec le tag [NON CONFIRMÉ]. Tu ne dois JAMAIS les traiter comme des faits établis.`
      : '';

    const systemPrompt = `Tu es SentiqS-Agent, un Agent de Renseignement et d'Analyse Sécuritaire ultra-rigoureux. Ta mission unique est d'aggréger, vérifier et synthétiser des actualités issues exclusivement de flux RSS validés et de sites web vérifiables.

Tu opères sous un principe de ZÉRO TOLÉRANCE aux hallucinations, rumeurs non fondées et extrapolations.

---

# RÈGLES STRICTES DE COLLECTE ET SOURCE

1. **Sources Autorisées Uniquement :**
   - Traite uniquement les données qui te sont fournies ci-dessous (flux RSS explicites et sites web officiels/reconnus).
   - Si une information ne contient pas d'URL source valide, active ou vérifiable, elle doit être STRICTEMENT REJETÉE de ton analyse.
   - Les flux avec source_status='dead' ou source_url manquant ne te sont PAS fournis — si tu en vois un, ignore-le.

2. **Pas d'Extrapolation :**
   - Ne devine JAMAIS les détails manquants (chiffres, lieux exacts, bilans humanitaires, noms d'organisations).
   - Si un détail n'est pas écrit noir sur blanc dans la source, indique-le comme "Non spécifié" ou "Information non disponible dans les sources".

3. **Déduplication & Recoupement :**
   - Regroupe les articles traitant du même événement sous une même analyse.
   - Ne compte pas deux fois le même incident dans les calculs de statistiques ou de niveaux de risque.
   - Signale explicitement quand plusieurs sources corroborent un même fait.

---

# DISTINCTION CRITIQUE : FAITS ÉTABLIS vs NON CONFIRMÉS

- **FAITS ÉTABLIS (VERIFIED / CONFIRMED) :** Ces informations sont corroborées par au moins 2 sources indépendantes OU proviennent d'agences officielles. Traite-les comme des faits. Cite la source.
- **NON CONFIRMÉ (UNVERIFIED) :** Ces informations proviennent d'une source unique. Présente-les TOUJOURS avec le tag [NON CONFIRMÉ]. Ne les amalgame JAMAIS avec des faits établis. Si un fait non confirmé contredit un fait établi, signale la contradiction.
${unverifiedNote}

---

# CONSIGNES DE RÉDACTION ET RESTITUTION

- **Attribution Obligatoire :** Toute affirmation doit citer explicitement sa source au format [Nom de la source](URL) ou [Source N°X].
- **Gestion de l'Incertitude :** Utilise des formulations factuelles et neutres. Si l'information est non vérifiée ou insuffisamment corroborée, appose clairement le tag [NON CONFIRMÉ].
- **Transparence sur les Manques :** En cas d'absence d'information dans les sources, écris explicitement "Données indisponibles" ou "Information non confirmée par les sources" au lieu d'inventer un texte de remplacement.
- Rédige en ${language === 'en' ? 'anglais' : 'français'} professionnel, concis, sans jargon inutile.

---

# STRUCTURE DE SORTIE EXIGÉE

Respecte STRICTEMENT ce format :

<SYNTHESE>
[2-3 phrases de synthèse globale — que doit retenir le décideur en priorité ?]
</SYNTHESE>

<NIVEAU_RISQUE>
low | moderate | high | critical
</NIVEAU_RISQUE>

<POINTS_CLES>
- [Fait — ≥2 sources] Point clé corroboré avec sources [N°X, N°Y]
- [Fait — 1 source] Point avec source unique [N°X]
- [Tendance] Tendance observée sur plusieurs flux
- [Alerte] Signal faible détecté — à surveiller
(5 à 10 points maximum)
</POINTS_CLES>

<INCIDENTS>
Pour chaque incident majeur, restitue au format JSON strict :
{
  "title": "Titre factuel de l'incident",
  "country_code": "Code ISO (ex: NG, CD, ML)",
  "location": "Ville / Région exacte mentionnée dans la source",
  "timestamp": "Date et heure de l'événement (ISO 8601)",
  "source_name": "Nom du média / organisme",
  "source_url": "https://...",
  "verification_status": "verified | unverified",
  "confidence_score": 0.0 à 1.0,
  "summary": "Résumé strictement factuel en 2-3 phrases max."
}
(3 à 8 incidents maximum — uniquement ceux à fort impact opérationnel)
</INCIDENTS>

<ANALYSE_PAYS>
Pour chaque pays mentionné :
- PAYS : [nom]
  - Situation : [résumé]
  - Évolution : [stable | dégradation | amélioration | volatile]
  - Facteurs de risque : [liste]
</ANALYSE_PAYS>

<RECOMMANDATIONS>
1. [Action prioritaire — faisable, concrète]
2. [Action secondaire]
3. [Point de vigilance]
(3 à 5 recommandations)
</RECOMMANDATIONS>

<FIABILITE>
- Nombre de sources analysées : [N] (dont [X] faits établis, [Y] non confirmés)
- Sources corroborées (≥2 sources) : [%]
- Score de confiance global : [0-100]%
- Limites de l'analyse : [si pertinent — ex: couverture partielle d'une région, absence de sources pour un pays]
</FIABILITE>

---

# GARDE-FOUS ET INTERDICTIONS ABSOLUES

- ❌ INTERDICTION de créer des données fictives ou des exemples ("mock data") en cas d'absence de résultat. Si aucune information n'est disponible sur un sujet, écris "Aucune donnée disponible dans les flux analysés".
- ❌ INTERDICTION de citer ou de t'appuyer sur une source dont le statut est "dead", "Inaccessible" ou non sécurisée.
- ❌ INTERDICTION de modifier la gravité d'un événement sans citation directe du texte source.
- ❌ INTERDICTION d'inventer un chiffre, un lieu, un bilan, un nom d'organisation qui n'est pas explicitement présent dans les flux fournis.
- ❌ INTERDICTION de considérer une information comme un fait si elle n'est corroborée que par une seule source (sauf agence officielle type AFP, Reuters, ONU).
- ❌ INTERDICTION de combler un vide informationnel. S'il n'y a pas de données pour un pays ou une période, dis-le explicitement.`;

    // --- 7. Construire le message utilisateur ---
    const verifiedCount = filterReport.verified.length;
    const unverifiedCount = filterReport.unverified.length;

    const userMessage = `TYPE D'ANALYSE : ${typeLabels[synthesisType] || synthesisType}
PÉRIODE : ${timeFilter}
PAYS : ${countryList}
CATÉGORIES : ${categoryList}
${body.query ? `QUESTION SPÉCIFIQUE : ${body.query}` : ''}

Voici ${filterReport.passed.length} flux filtrés (${verifiedCount} faits établis, ${unverifiedCount} non confirmés) à analyser :

${feedsText}

Produis l'analyse complète en suivant STRICTEMENT le format défini dans les instructions système. N'invente rien. Cite tes sources.`;

    // --- 8. Call Claude ---
    const anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return new Response(JSON.stringify({
        error: 'Anthropic API error',
        status: anthropicResponse.status,
        detail: errText.substring(0, 500),
      }), { status: 502, headers });
    }

    const claudeData = await anthropicResponse.json();
    const fullContent = claudeData.content?.[0]?.text || '';

    if (!fullContent) {
      return new Response(JSON.stringify({
        error: 'Empty response from Claude',
      }), { status: 502, headers });
    }

    // --- 9. VÉRIFICATION POST-GÉNÉRATION ---
    const postWarnings = verifyOutputAgainstFeeds(fullContent, groundTruth);

    // Append warnings to the content if any
    let finalContent = fullContent;
    if (postWarnings.length > 0) {
      finalContent += '\n\n---\n';
      finalContent += '## ⚠️ ALERTES DE VÉRIFICATION POST-GÉNÉRATION\n\n';
      finalContent += 'Les vérifications automatiques suivantes ont détecté des incohérences potentielles '
        + 'entre le texte généré et les sources fournies. Ces passages doivent être vérifiés manuellement '
        + 'avant diffusion.\n\n';
      for (const w of postWarnings) {
        finalContent += `- ${w}\n`;
      }
    }

    // --- 10. Parse Claude's structured response ---
    function extractSection(text: string, tag: string): string {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    }

    function extractList(text: string): string[] {
      return text
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }

    const syntheseText = extractSection(finalContent, 'SYNTHESE');
    const riskLevelRaw = extractSection(finalContent, 'NIVEAU_RISQUE').toLowerCase();
    const pointsClesRaw = extractSection(finalContent, 'POINTS_CLES');
    const incidentsRaw = extractSection(finalContent, 'INCIDENTS');
    const analysePaysRaw = extractSection(finalContent, 'ANALYSE_PAYS');
    const recommandationsRaw = extractSection(finalContent, 'RECOMMANDATIONS');
    const fiabiliteRaw = extractSection(finalContent, 'FIABILITE');

    const validRiskLevels = ['low', 'moderate', 'high', 'critical'];
    const riskLevel = validRiskLevels.includes(riskLevelRaw) ? riskLevelRaw : 'moderate';

    const keyFindings = extractList(pointsClesRaw);
    const recommendations = extractList(recommandationsRaw);

    // Parse incidents JSON
    let parsedIncidents: Record<string, unknown>[] = [];
    if (incidentsRaw) {
      try {
        const cleaned = incidentsRaw
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        const candidate = JSON.parse(cleaned);
        parsedIncidents = Array.isArray(candidate) ? candidate : [candidate];
      } catch {
        parsedIncidents = [{ raw: incidentsRaw }];
      }
    }

    // Build title
    const countryLabel = body.countries?.length === 1
      ? body.countries[0]
      : body.countries && body.countries.length > 1
        ? `${body.countries.length} pays`
        : 'Afrique';

    const title = `${typeLabels[synthesisType] || 'Analyse'} — ${countryLabel} — ${new Date().toLocaleDateString('fr-FR')}`;
    const titleEn = `${typeLabels[synthesisType] || 'Analysis'} — ${countryLabel} — ${new Date().toLocaleDateString('en-US')}`;

    // --- 11. Store in database ---
    const feedIds = filterReport.passed.map(f => f.id);
    const allCountries = [...new Set(filterReport.passed.map(f => f.country).filter(Boolean))];
    const allCategories = [...new Set(filterReport.passed.map(f => f.category).filter(Boolean))];

    const { data: inserted, error: insertError } = await supabase
      .from('agent_syntheses')
      .insert({
        title,
        title_en: titleEn,
        type: synthesisType,
        content: finalContent,
        content_en: '',
        countries: allCountries,
        categories: allCategories,
        feed_ids: feedIds,
        risk_level: riskLevel,
        key_findings: keyFindings,
        recommendations,
        source_count: filterReport.passed.length,
        status: 'published',
        created_by: 'agent',
      })
      .select('id')
      .single();

    // --- 12. Response ---
    return new Response(JSON.stringify({
      success: true,
      synthesis: {
        id: inserted?.id,
        title,
        type: synthesisType,
        synthese: syntheseText,
        risk_level: riskLevel,
        key_findings: keyFindings,
        recommendations,
        countries: allCountries,
        categories: allCategories,
        source_count: filterReport.passed.length,
        verified_count: verifiedCount,
        unverified_count: unverifiedCount,
        incidents: parsedIncidents,
        fiabilite: fiabiliteRaw,
        content: finalContent,
        post_generation_warnings: postWarnings,
        created_at: new Date().toISOString(),
      },
      filter_stats: {
        total_fetched: filterReport.total_fetched,
        passed: filterReport.passed.length,
        rejected_synthetic_id: filterReport.rejected_synthetic_id.length,
        rejected_bad_url: filterReport.rejected_bad_url.length,
        rejected_dead_source: filterReport.rejected_dead_source.length,
        rejected_high_hallucination: filterReport.rejected_high_hallucination.length,
        verified: verifiedCount,
        unverified: unverifiedCount,
      },
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});
