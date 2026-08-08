import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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

interface VerifiedFeed {
  id: string;
  title: string;
  title_en?: string;
  source: string;
  source_url: string;
  timestamp: string;
  category: string;
  country: string;
  department?: string;
  locality?: string;
  verification_status: string;
  hallucination_score: number;
  summary?: string;
  translated_title?: string;
  translated_summary?: string;
}

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

    // --- 1. Fetch verified feeds ---
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
      .lte('hallucination_score', 0.4)
      .in('verification_status', ['verified', 'confirmed'])
      .order('timestamp', { ascending: false })
      .limit(maxFeeds);

    if (body.countries && body.countries.length > 0) {
      query = query.in('country', body.countries);
    }

    if (body.categories && body.categories.length > 0) {
      query = query.in('category', body.categories);
    }

    const { data: feeds, error: fetchError } = await query;

    if (fetchError) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch feeds',
        detail: fetchError.message,
      }), { status: 500, headers });
    }

    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({
        error: 'No verified feeds found matching criteria',
        detail: 'Try broadening your search parameters.',
      }), { status: 404, headers });
    }

    // --- 2. Format feeds for Claude ---
    const feedsText = (feeds as VerifiedFeed[]).map((f, i) => {
      const title = language === 'en' ? (f.translated_title || f.title_en || f.title) : f.title;
      const summary = language === 'en' ? (f.translated_summary || f.summary || '') : (f.summary || '');
      return `[${i + 1}] SOURCE: ${f.source} | PAYS: ${f.country || 'N/A'} | CATÉGORIE: ${f.category || 'N/A'} | DATE: ${f.timestamp}
TITRE: ${title}${summary ? `\nRÉSUMÉ: ${summary}` : ''}
URL: ${f.source_url || 'N/A'}
HALLUCINATION_SCORE: ${f.hallucination_score}`;
    }).join('\n\n---\n\n');

    const countryList = body.countries?.length ? body.countries.join(', ') : 'tous les pays africains concernés';
    const categoryList = body.categories?.length ? body.categories.join(', ') : 'toutes catégories';

    // --- 3. Build system prompt ---
    const typeLabels: Record<string, string> = {
      daily_briefing: 'Briefing Quotidien',
      weekly_report: 'Rapport Hebdomadaire',
      ad_hoc: 'Analyse Ponctuelle',
      threat_assessment: 'Évaluation de Menace',
      situational_update: 'Point de Situation',
    };

    const systemPrompt = `Tu es SentiqS-Agent, un analyste de renseignement expert pour l'Afrique (54 pays). Ta mission : analyser des flux d'actualités vérifiés et produire des synthèses actionnables pour des responsables sûreté.

RÈGLES IMPÉRATIVES :
1. N'invente JAMAIS un fait, un chiffre, un lieu ou un événement qui n'est pas explicitement mentionné dans les sources fournies.
2. Si l'information est insuffisante pour conclure, dis-le explicitement.
3. Cite tes sources entre parenthèses [Source N°X] pour chaque affirmation.
4. Distingue clairement les FAITS (confirmés par au moins 2 sources) des TENDANCES (inférées) et des ALERTES (signaux faibles).
5. Priorise les informations à fort impact opérationnel (sécurité, stabilité politique, crises humanitaires).
6. Rédige en ${language === 'en' ? 'anglais' : 'français'} professionnel, concis, sans jargon inutile.

Format de sortie — respecte STRICTEMENT cette structure :

<SYNTHESE>
[2-3 phrases de synthèse globale — que doit retenir le décideur en priorité ?]
</SYNTHESE>

<NIVEAU_RISQUE>
low | moderate | high | critical
</NIVEAU_RISQUE>

<POINTS_CLES>
- [Fait] Point clé 1 avec source [N°X, N°Y]
- [Fait] Point clé 2 avec source [N°X]
- [Tendance] Tendance observée
- [Alerte] Signal faible détecté
(5 à 10 points maximum)
</POINTS_CLES>

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
- Nombre de sources analysées : [N]
- Sources corroborées (≥2 sources) : [%]
- Score de confiance global : [0-100]%
- Limites de l'analyse : [si pertinent]
</FIABILITE>`;

    // --- 4. Call Claude ---
    const userMessage = `TYPE D'ANALYSE : ${typeLabels[synthesisType] || synthesisType}
PÉRIODE : ${timeFilter}
PAYS : ${countryList}
CATÉGORIES : ${categoryList}
${body.query ? `QUESTION SPÉCIFIQUE : ${body.query}` : ''}

Voici ${feeds.length} flux vérifiés à analyser :

${feedsText}

Produis l'analyse complète en suivant strictement le format défini.`;

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

    // --- 5. Parse Claude's structured response ---
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

    const syntheseText = extractSection(fullContent, 'SYNTHESE');
    const riskLevelRaw = extractSection(fullContent, 'NIVEAU_RISQUE').toLowerCase();
    const pointsClesRaw = extractSection(fullContent, 'POINTS_CLES');
    const analysePaysRaw = extractSection(fullContent, 'ANALYSE_PAYS');
    const recommandationsRaw = extractSection(fullContent, 'RECOMMANDATIONS');
    const fiabiliteRaw = extractSection(fullContent, 'FIABILITE');

    const validRiskLevels = ['low', 'moderate', 'high', 'critical'];
    const riskLevel = validRiskLevels.includes(riskLevelRaw) ? riskLevelRaw : 'moderate';

    const keyFindings = extractList(pointsClesRaw);
    const recommendations = extractList(recommandationsRaw);

    // Build title
    const countryLabel = body.countries?.length === 1
      ? body.countries[0]
      : body.countries && body.countries.length > 1
        ? `${body.countries.length} pays`
        : 'Afrique';

    const title = `${typeLabels[synthesisType] || 'Analyse'} — ${countryLabel} — ${new Date().toLocaleDateString('fr-FR')}`;
    const titleEn = `${typeLabels[synthesisType] || 'Analysis'} — ${countryLabel} — ${new Date().toLocaleDateString('en-US')}`;

    // --- 6. Store in database ---
    const feedIds = (feeds as VerifiedFeed[]).map(f => f.id);
    const allCountries = [...new Set((feeds as VerifiedFeed[]).map(f => f.country).filter(Boolean))];
    const allCategories = [...new Set((feeds as VerifiedFeed[]).map(f => f.category).filter(Boolean))];

    const { data: inserted, error: insertError } = await supabase
      .from('agent_syntheses')
      .insert({
        title,
        title_en: titleEn,
        type: synthesisType,
        content: fullContent,
        content_en: '',
        countries: allCountries,
        categories: allCategories,
        feed_ids: feedIds,
        risk_level: riskLevel,
        key_findings: keyFindings,
        recommendations,
        source_count: feeds.length,
        status: 'published',
        created_by: 'agent',
      })
      .select('id')
      .single();

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
        source_count: feeds.length,
        fiabilite: fiabiliteRaw,
        content: fullContent,
        created_at: new Date().toISOString(),
      },
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});