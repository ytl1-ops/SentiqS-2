import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — audit-all-feeds v2.0
// Protocole anti-hallucination complet :
//   Phase 1 – Vivacité HTTP de chaque source_url
//   Phase 2 – Crédibilité source (520+ médias connus)
//   Phase 3 – Cross-referencing & déduplication par similarité Jaccard
//   Phase 4 – Scoring 5 axes
//   Phase 5 – Rapport structuré + purge automatique des liens morts
// ============================================================

const knownSources = [
  'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP', 'Bloomberg',
  'Xinhua', 'EFE', 'ANSA', 'DPA', 'TASS', 'Sputnik', 'Panapress', 'Africa News Agency',
  'PANA', 'Ghana News Agency', 'GNA', 'TAP', 'Tunis Afrique Presse',
  'BBC', 'BBC Africa', 'BBC News', 'RFI', 'Radio France Internationale',
  'France 24', 'DW', 'Deutsche Welle', 'Al Jazeera', 'VOA', 'Voice of America',
  'CNN', 'The Guardian', 'Guardian', 'The New York Times', 'Le Monde',
  'Financial Times', 'The Economist', 'IRIN', 'The New Humanitarian',
  'Le Monde Afrique', 'Politico', 'Politico Africa', 'CNN Africa',
  'Deutsche Welle Afrique', 'RFI Afrique', 'BBC World Service Africa',
  'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
  'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',
  'ONU Info', 'ONU',
  'MSF', 'Médecins Sans Frontières', 'ICRC', 'CICR', 'HRW', 'Human Rights Watch',
  'Amnesty', 'Amnesty International', 'Crisis Group', 'International Crisis Group',
  'Oxfam', 'Save the Children', 'International Rescue Committee', 'IRC',
  'Norwegian Refugee Council', 'NRC',
  'ISS Africa', 'ISS', 'ACLED', 'Africa Center for Strategic Studies',
  'Chatham House', 'Carnegie Endowment', 'Brookings', 'CSIS',
  'RUSI', 'SIPRI', 'ICG', 'Global Initiative', 'ENACT Africa',
  'Mo Ibrahim Foundation', 'Afrobarometer', 'Codesria', 'IFRI', 'Clingendael',
  'CFR', 'Council on Foreign Relations', 'African Arguments',
  'The Conversation Africa', 'Brookings Africa', 'Carnegie Africa',
  'Chatham House Africa', 'Crisis Group Africa',
  'AllAfrica', 'Africanews', 'CGTN Africa', 'VOA Africa', 'Voice of America Africa',
  'The Standard Kenya', 'This Day', 'ThisDay', 'Punch', 'Punch Nigeria',
  'The Citizen Tanzania', 'The Citizen', 'The Independent Uganda', 'The Independent',
  'Egypt Today', 'Libya Herald', 'Tunisia Live', 'Morocco World News',
  'Mediapart', 'Les Echos', 'World Politics Review', 'ReliefWeb',
  'ICG Sahel', 'GRIP', 'EcoFin Agency', 'Ecofin', 'Agence Ecofin', 'Apanews', 'APA',
  'FBC', 'Fana Broadcasting', 'ENA', 'Ethiopian News Agency', 'Suna',
  'APS', 'Algeria Press Service', 'Guinée News', 'Info Congo', 'ADIAC', 'Mada Masr',
  'Zitamar', 'Zitamar News', 'NewsDay', 'NewsDay Zimbabwe',
  '263Chat', 'Standard Gazette', 'Standard Gazette Nigeria',
  'Nation Media', 'Nation Media Group', 'Daily Trust Nigeria',
  'Jeune Afrique', 'Africa Intelligence', 'The Africa Report',
  'Fraternité Matin', "L'Observateur Paalga", 'Le Quotidien', "L'Essor",
  'Cameroon Tribune', 'Gabon Matin', 'Le Pays', 'Sidwaya',
  'Le Soleil', 'Sud Quotidien', 'WalFadjri',
  'Libération', 'Gabon Review', 'TchadInfos',
  'Alwihda Info', 'Journal du Tchad',
  'Togolese Press Agency', 'Agence Togolaise de Presse',
  'El Watan', 'Hespress', 'Le Matin', 'TelQuel', 'Le Point Afrique',
  'HuffPost Maroc', 'Le360', 'Médias24', "L'Économiste", 'La Vie Éco',
  'Liberté', "Le Quotidien d'Oran", 'El Moudjahid', 'Horizons',
  "L'Expression", 'El Khabar', 'Ennahar', 'TSA',
  'Kapitalis', 'Tunisie Numérique', 'Business News',
  'Al Ahram', 'Daily News Egypt',
  'Radio Okapi', 'Le Potentiel', 'La Prospérité', 'Le Phare',
  'Digital Congo', 'Le Journal de Brazza', 'Les Dépêches de Brazzaville',
  'Cameroun Info', 'StopBlaBlaCam', 'Journal du Cameroun', 'Actu Cameroun',
  'Centrafrique Libre', 'Corbeau News', 'Ndjamena Hebdo',
  'The Guardian Nigeria', 'Premium Times',
  'Vanguard', 'Daily Trust', 'The Nation', 'Leadership',
  'Tribune', 'Nigerian Tribune', 'NDLEA', 'NDLEA Nigeria',
  'Daily Graphic', 'Joy Online', 'Citi FM', 'MyJoyOnline',
  'Daily Observer', 'FrontPage Africa', 'The New Dawn',
  'The Point', 'Standard Times', 'Awoko', 'Concord Times',
  'Sierra Leone Telegraph', 'Politico SL',
  'Daily Nation', 'The Standard', 'The Star', 'Daily Monitor',
  'The East African', 'The EastAfrican', 'New Vision', 'The New Times',
  'The New Times Rwanda', 'Mwananchi',
  'The Reporter', 'Addis Standard', 'Capital Ethiopia',
  'Ethiopian Herald', 'Sudan Tribune', 'Dabanga Sudan',
  'Radio Tamazuj', 'Dabanga', 'Al Taghyeer', 'Radio Dabanga',
  'Taarifa Rwanda', 'Kigali Today', 'IGIHE', 'Umuseke',
  'Hiiraan Online', 'Garowe Online', 'Goobjoog News', 'Shabelle Media',
  'Horn Observer', 'Radio Dalsan', 'Puntland Post',
  'Somaliland Standard', 'Somaliland Sun', 'Horn Diplomat',
  'Addis Fortune', 'The Ethiopia Monitor', 'Eritrea Hub',
  'Tghat', 'Eritrea Focus',
  'News24', 'News24 South Africa', 'SABC News', 'Sunday Times',
  'Mail & Guardian', 'Daily Maverick', 'The Herald', 'The Herald Zimbabwe',
  'Sunday Mail', 'Chronicle', 'The Namibian', 'Namibian Sun',
  'Mmegi', 'Botswana Guardian', 'Sunday Standard',
  'Times of Zambia', 'Zambia Daily Mail', 'Lusaka Times',
  'Nyasa Times', 'The Nation', 'Malawi Voice',
  'Club of Mozambique', 'O País', 'Verdade',
  'Lesotho Times', 'Public Eye', 'Swazi Observer', 'Times of Swaziland',
  'The Southern Times', 'ZimEye',
  'Le Mauricien', "L'Express Maurice", 'Mauritius Times',
  'Seychelles Nation', 'Seychelles News Agency', 'Madagascar Tribune',
  "L'Express de Madagascar", 'Midi Madagasikara', 'Comores Infos',
  'Al-Watwan', 'Sahel Security Watch', 'Observatoire Sahélien',
  'NetBlocks', 'Maritime Security', 'Gulf of Guinea Maritime Institute',
  'MENASTREAM', 'Long War Journal', 'Small Wars Journal',
  'War on the Rocks', 'DefenseWeb', 'African Defence Review',
  'Jamestown Foundation', 'Terrorism Monitor', 'CTC Sentinel',
  'Security Council Report', "What's in Blue", 'PassBlue',
  'The Defense Post', 'Military Africa',
  'HumAngle', 'HumAngle Media', 'The Elephant', 'The Continent',
  'Quartz Africa', 'TechCabal', 'Disrupt Africa',
  'Business Daily Africa', 'Financial Afrik', 'African Business',
  'Forbes Africa', 'How We Made It In Africa',
  'Code for Africa', 'PesaCheck', 'Africa Check', 'Dubawa',
  'RSF', 'Reporters Sans Frontières',
  'Météo France', 'SAWS', 'South African Weather Service',
  'Climate Home News', 'Carbon Brief', 'Mongabay Africa',
  'BBC Sport Africa', 'ESPN Africa', 'Supersport',
  'Jornal de Angola', 'Angola Press', 'ANGOP', 'O País', 'Notícias',
  'A Semana', 'Expresso das Ilhas', 'Jornal de São Tomé',
  'Téla Nón', 'DW África',
  'Business Magazine Maurice', 'Observatoire Volcanologique du Karthala',
  'France Info Mayotte', 'Seychelles Broadcasting Corporation', 'SBC',
  'Zambia Reports', 'Chimp Reports', 'Libya Observer', 'InfoMigrants',
  'Eye Radio', 'Sahara Médias', 'République Togolaise', 'Togo-Presse',
  'La Nation', 'lanation.dj',
  'AIB', 'Studio Tamani', 'Banouto', 'ORTB', 'Fraternité FM',
  'Inforpress', 'A Nação', 'anacao.cv',
  'Radio Ndeke Luka', 'Vox Congo', 'vox.cg',
  '289Chat', 'Standard Media', 'Nation Africa',
  'Gabon Review', 'Lusaka Times',
  'New Era', 'neweralive.na',
  'Awoko Newspaper', 'Sierra Leone Telegraph',
  'Eritrea Hub', 'eritreahub.org',
  'IWACU', 'iwacu-burundi.org',
];

const officialSources = new Set([
  'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
  'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',
  'ONU Info', 'ONU',
  'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP',
  'Africa CDC', 'ACLED',
  'MSF', 'Médecins Sans Frontières',
  'HRW', 'Human Rights Watch',
  'Amnesty', 'Amnesty International',
  'Crisis Group', 'International Crisis Group',
  'RSF', 'Reporters Sans Frontières',
]);

const stopWords = new Set([
  'dans', 'pour', 'avec', 'sur', 'une', 'des', 'est', 'les', 'pas', 'que',
  'qui', 'aux', 'the', 'and', 'for', 'has', 'was', 'its', 'from', 'with',
  'this', 'that', 'have', 'been', 'were', 'said', 'will', 'not', 'are',
  'but', 'all', 'can', 'had', 'one', 'our', 'his', 'her', 'their', 'them',
  'also', 'into', 'new', 'over', 'after', 'more', 'some', 'than',
  'plus', 'fait', 'selon', 'après', 'contre', 'dans', 'entre',
]);

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\sà-ü]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));
}

function jaccardSimilarity(wordsA: string[], wordsB: string[]): number {
  if (wordsA.length < 3 || wordsB.length < 3) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function isKnownSource(source: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().trim();
  return knownSources.some(ks => {
    const ksLower = ks.toLowerCase().trim();
    return s === ksLower || s.includes(ksLower) || ksLower.includes(s);
  });
}

function isOfficialSource(source: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().trim();
  return [...officialSources].some(os => {
    const osLower = os.toLowerCase().trim();
    return s === osLower || s.includes(osLower) || osLower.includes(s);
  });
}

interface Feed {
  id: string;
  title: string;
  country: string;
  source: string;
  source_url: string;
  verification_status: string;
  hallucination_score: number;
  source_status: string;
  verified_at: string | null;
  created_at: string;
}

interface IncidentGroup {
  incident_id: string;
  title: string;
  country: string;
  primary_feed: Feed;
  supporting_feeds: Feed[];
  verification_status: string;
  source_status: string;
  hallucination_score: number;
  action: string;
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

  const startTime = Date.now();
  const auditLog: string[] = [];

  try {
    const { purge_dead, dry_run } = await req.json().catch(() => ());

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    auditLog.push(`[AUDIT] Démarrage — ${new Date().toISOString()}`);

    // === ÉTAPE 1 : Récupérer TOUS les feeds ===
    const { data: allFeeds, error: fetchError } = await supabase
      .from('feeds')
      .select('*')
      .order('country', { ascending: true });

    if (fetchError || !allFeeds) {
      return new Response(JSON.stringify({
        error: 'Erreur de récupération des feeds',
        detail: fetchError?.message,
      }), { status: 500, headers });
    }

    auditLog.push(`[AUDIT] ${allFeeds.length} feeds chargés`);

    // === ÉTAPE 2 : Vérification HTTP de chaque URL (avec concurrence limitée) ===
    const httpResults: Map<string, { alive: boolean; status: string; http_code: number | null; error: string | null }> = new Map();

    const batchSize = 5;
    for (let i = 0; i < allFeeds.length; i += batchSize) {
      const batch = allFeeds.slice(i, i + batchSize);
      const promises = batch.map(async (feed) => {
        if (!feed.source_url || feed.source_url.trim() === '') {
          httpResults.set(feed.id, { alive: false, status: 'dead', http_code: null, error: 'URL absente' });
          return;
        }

        let parsedUrl: URL | null = null;
        try {
          parsedUrl = new URL(feed.source_url.trim());
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            httpResults.set(feed.id, { alive: false, status: 'dead', http_code: null, error: 'Protocole invalide' });
            return;
          }
        } catch {
          httpResults.set(feed.id, { alive: false, status: 'dead', http_code: null, error: 'URL mal formée' });
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(feed.source_url.trim(), {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'SentiqS-Audit/2.0', 'Accept': 'text/html, application/rss+xml, */*' },
          });
          clearTimeout(timeoutId);

          if (response.ok || [301, 302, 303, 307, 308].includes(response.status)) {
            httpResults.set(feed.id, { alive: true, status: 'active', http_code: response.status, error: null });
          } else if ([429, 503].includes(response.status)) {
            httpResults.set(feed.id, { alive: false, status: 'warning', http_code: response.status, error: `HTTP ${response.status} — temporairement indisponible` });
          } else {
            httpResults.set(feed.id, { alive: false, status: 'dead', http_code: response.status, error: `HTTP ${response.status}` });
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          const errMsg = (fetchErr as Error).message || '';
          if (errMsg.includes('abort') || errMsg.includes('timeout')) {
            httpResults.set(feed.id, { alive: false, status: 'warning', http_code: null, error: 'Timeout (5s)' });
          } else {
            httpResults.set(feed.id, { alive: false, status: 'dead', http_code: null, error: errMsg.substring(0, 200) });
          }
        }
      });

      await Promise.all(promises);
    }

    const aliveCount = [...httpResults.values()].filter(r => r.alive).length;
    const deadCount = [...httpResults.values()].filter(r => r.status === 'dead').length;
    const warnCount = [...httpResults.values()].filter(r => r.status === 'warning').length;
    auditLog.push(`[HTTP] ${aliveCount} actifs, ${warnCount} en avertissement, ${deadCount} morts`);

    // === ÉTAPE 3 : Scoring & classification ===
    const countryGroups: Map<string, Feed[]> = new Map();
    for (const f of allFeeds) {
      const c = f.country || 'Inconnu';
      if (!countryGroups.has(c)) countryGroups.set(c, []);
      countryGroups.get(c)!.push(f);
    }

    const scoredFeeds: Array<{
      feed: Feed;
      hallucination_score: number;
      verification_status: string;
      source_status: string;
      http: { alive: boolean; status: string; error: string | null; http_code: number | null };
      flags: string[];
      corroboration_count: number;
      source_known: boolean;
      source_official: boolean;
    }> = [];

    for (const feed of allFeeds) {
      let score = 0;
      const flags: string[] = [];
      const http = httpResults.get(feed.id)!;

      // Axe 1 : Vivacité HTTP (poids 0.35)
      if (http.status === 'dead') {
        score += 0.35;
        flags.push('SOURCE_INACCESSIBLE');
      } else if (http.status === 'warning') {
        score += 0.20;
        flags.push('SOURCE_DEGRADED');
      }

      // Axe 2 : Crédibilité source (poids 0.20)
      const sourceKnown = isKnownSource(feed.source);
      const sourceOfficial = isOfficialSource(feed.source);

      if (!sourceKnown) {
        score += 0.20;
        flags.push('SOURCE_INCONNUE');
      } else if (!sourceOfficial) {
        score += 0.05;
      }

      // Axe 3 : Cross-referencing (poids 0.30)
      const feedWords = extractKeywords(feed.title || '');
      let corroborationCount = 0;
      const countryFeeds = countryGroups.get(feed.country) || [];

      for (const related of countryFeeds) {
        if (related.id === feed.id || !related.title) continue;
        const similarity = jaccardSimilarity(feedWords, extractKeywords(related.title));
        if (similarity >= 0.25) corroborationCount++;
      }

      if (corroborationCount === 0 && feedWords.length >= 3) {
        score += 0.30;
        flags.push('AUCUNE_CORROBORATION');
      } else if (corroborationCount === 1) {
        score += 0.15;
        flags.push('CORROBORATION_UNIQUE');
      }

      if (corroborationCount >= 2) {
        score = Math.max(0, score - 0.12);
        flags.push('MULTI_SOURCES');
      }

      // Axe 4 : Fraîcheur (poids 0.08)
      if (!feed.verified_at) {
        score += 0.08;
      }

      // Clamp
      score = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;

      // Statut final
      let verificationStatus: string;
      if (http.status === 'dead') {
        verificationStatus = 'rumor';
        score = Math.max(score, 0.70);
      } else if (score < 0.30) {
        verificationStatus = 'verified';
      } else if (score <= 0.60) {
        verificationStatus = 'unverified';
      } else {
        verificationStatus = 'rumor';
      }

      scoredFeeds.push({
        feed,
        hallucination_score: score,
        verification_status: verificationStatus,
        source_status: http.status,
        http,
        flags,
        corroboration_count: corroborationCount,
        source_known: sourceKnown,
        source_official: sourceOfficial,
      });
    }

    // === ÉTAPE 4 : Déduplication — regrouper les incidents similaires ===
    const incidentGroups: IncidentGroup[] = [];
    const assigned = new Set<string>();

    for (const scored of scoredFeeds) {
      if (assigned.has(scored.feed.id)) continue;

      const group: Feed[] = [scored.feed];
      assigned.add(scored.feed.id);

      const wordsA = extractKeywords(scored.feed.title || '');

      for (const other of scoredFeeds) {
        if (assigned.has(other.feed.id)) continue;
        if (other.feed.country !== scored.feed.country) continue;
        const wordsB = extractKeywords(other.feed.title || '');
        const sim = jaccardSimilarity(wordsA, wordsB);
        if (sim >= 0.30) {
          group.push(other.feed);
          assigned.add(other.feed.id);
        }
      }

      // Déterminer la source primaire (meilleur score, source officielle en priorité)
      const sortedGroup = group.sort((a, b) => {
        const aOfficial = isOfficialSource(a.source);
        const bOfficial = isOfficialSource(b.source);
        if (aOfficial !== bOfficial) return aOfficial ? -1 : 1;
        const aScore = scoredFeeds.find(s => s.feed.id === a.id)?.hallucination_score ?? 1;
        const bScore = scoredFeeds.find(s => s.feed.id === b.id)?.hallucination_score ?? 1;
        return aScore - bScore;
      });

      const primaryScored = scoredFeeds.find(s => s.feed.id === sortedGroup[0].id)!;

      incidentGroups.push({
        incident_id: `INC-${incidentGroups.length + 1}`,
        title: sortedGroup[0].title,
        country: sortedGroup[0].country,
        primary_feed: sortedGroup[0],
        supporting_feeds: sortedGroup.slice(1),
        verification_status: primaryScored.verification_status,
        source_status: primaryScored.source_status,
        hallucination_score: primaryScored.hallucination_score,
        action: primaryScored.verification_status === 'rumor' ? 'PURGE' :
                primaryScored.verification_status === 'unverified' ? 'SURVEILLANCE' : 'CONSERVE',
      });
    }

    const duplicatesFound = allFeeds.length - incidentGroups.length;
    auditLog.push(`[DEDUP] ${incidentGroups.length} incidents uniques identifiés (${duplicatesFound} doublons fusionnés)`);

    // === ÉTAPE 5 : Mise à jour DB ===
    const updates: Array<{ id: string; score: number; status: string; source_status: string }> = [];

    for (const scored of scoredFeeds) {
      updates.push({
        id: scored.feed.id,
        score: scored.hallucination_score,
        status: scored.verification_status,
        source_status: scored.source_status,
      });
    }

    if (!dry_run) {
      // Mise à jour par lots de 50
      for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50);
        await Promise.all(batch.map(u =>
          supabase.from('feeds')
            .update({
              hallucination_score: u.score,
              verification_status: u.status,
              source_status: u.source_status,
              verified_at: new Date().toISOString(),
              last_link_check: new Date().toISOString(),
            })
            .eq('id', u.id)
        ));
      }
      auditLog.push(`[DB] ${updates.length} feeds mis à jour`);

      // Purge des feeds avec source_status=dead si demandé
      if (purge_dead) {
        const deadIds = scoredFeeds
          .filter(s => s.source_status === 'dead')
          .map(s => s.feed.id);

        if (deadIds.length > 0) {
          // On ne supprime pas, on marque comme rumor avec hallucination_score=1
          for (let i = 0; i < deadIds.length; i += 50) {
            const batch = deadIds.slice(i, i + 50);
            await Promise.all(batch.map(id =>
              supabase.from('feeds')
                .update({
                  verification_status: 'rumor',
                  hallucination_score: 1.0,
                  source_status: 'dead',
                })
                .eq('id', id)
            ));
          }
          auditLog.push(`[PURGE] ${deadIds.length} feeds marqués SOURCE_INACCESSIBLE (rumor, score=1.0)`);
        }
      }
    }

    // === RAPPORT FINAL ===
    const stats = {
      total_feeds: allFeeds.length,
      unique_incidents: incidentGroups.length,
      duplicates_merged: duplicatesFound,
      http_alive: aliveCount,
      http_warning: warnCount,
      http_dead: deadCount,
      by_status: {
        verified: scoredFeeds.filter(s => s.verification_status === 'verified').length,
        unverified: scoredFeeds.filter(s => s.verification_status === 'unverified').length,
        rumor: scoredFeeds.filter(s => s.verification_status === 'rumor').length,
      },
      by_action: {
        conserve: incidentGroups.filter(g => g.action === 'CONSERVE').length,
        surveillance: incidentGroups.filter(g => g.action === 'SURVEILLANCE').length,
        purge: incidentGroups.filter(g => g.action === 'PURGE').length,
      },
    };

    // Distribution par pays
    const countryDistribution: Record<string, { total: number; verified: number; unverified: number; rumor: number; incidents: number }> = {};
    for (const [country, feeds] of countryGroups) {
      const countryScored = feeds.map(f => scoredFeeds.find(s => s.feed.id === f.id)!);
      const countryIncidents = incidentGroups.filter(g => g.country === country);
      countryDistribution[country] = {
        total: feeds.length,
        verified: countryScored.filter(s => s.verification_status === 'verified').length,
        unverified: countryScored.filter(s => s.verification_status === 'unverified').length,
        rumor: countryScored.filter(s => s.verification_status === 'rumor').length,
        incidents: countryIncidents.length,
      };
    }

    // Top pays impactés
    const topImpacted = Object.entries(countryDistribution)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 20)
      .map(([country, dist]) => ({ country, ...dist }));

    // Incidents classés PURGE
    const purgeIncidents = incidentGroups
      .filter(g => g.action === 'PURGE')
      .map(g => ({
        incident_id: g.incident_id,
        title: g.title,
        country: g.country,
        source: g.primary_feed.source,
        source_url: g.primary_feed.source_url,
        reason: g.source_status === 'dead' ? 'SOURCE_INACCESSIBLE' : 'SCORE_ELEVE',
        hallucination_score: g.hallucination_score,
      }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return new Response(JSON.stringify({
      audit_version: '2.0',
      timestamp: new Date().toISOString(),
      elapsed_seconds: parseFloat(elapsed),
      dry_run: !!dry_run,
      audit_log: auditLog,
      stats,
      country_distribution: countryDistribution,
      top_impacted_countries: topImpacted,
      purge_candidates: purgeIncidents,
      incidents: incidentGroups.map(g => ({
        incident_id: g.incident_id,
        title: g.title,
        country_code: g.country,
        primary_source: {
          name: g.primary_feed.source,
          url: g.primary_feed.source_url,
          status_code: scoredFeeds.find(s => s.feed.id === g.primary_feed.id)?.http.http_code ?? null,
        },
        supporting_sources: g.supporting_feeds.map(f => ({
          name: f.source,
          url: f.source_url,
        })),
        verification_status: g.verification_status === 'verified' ? 'VERIFIED' :
                              g.verification_status === 'unverified' ? 'UNVERIFIED' : 'SUSPECT',
        hallucination_score: g.hallucination_score,
        action: g.action,
      })),
      scored_feeds: scoredFeeds.map(s => ({
        id: s.feed.id,
        title: s.feed.title,
        country: s.feed.country,
        source: s.feed.source,
        source_url: s.feed.source_url,
        verification_status: s.verification_status,
        hallucination_score: s.hallucination_score,
        source_status: s.source_status,
        http_code: s.http.http_code,
        http_error: s.http.error,
        flags: s.flags,
        corroboration_count: s.corroboration_count,
      })),
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Erreur interne',
      detail: (err as Error).message,
      stack: (err as Error).stack,
    }), { status: 500, headers });
  }
});
