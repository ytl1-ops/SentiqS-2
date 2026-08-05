import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — batch-verify-feeds v1.0
// Exécute verify-feed v3.0 sur tous les feeds unchecked
// Retourne un rapport complet pays par pays
// ============================================================

const knownSources = [
  'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP', 'Bloomberg',
  'Xinhua', 'EFE', 'ANSA', 'DPA', 'TASS', 'Sputnik', 'Panapress', 'Africa News Agency', 'ANA',
  'PANA', 'Agence Congolaise de Presse', 'ACP', 'Ghana News Agency', 'GNA',
  'TAP', 'Tunis Afrique Presse',
  'BBC', 'BBC Africa', 'BBC News', 'RFI', 'Radio France Internationale',
  'France 24', 'DW', 'Deutsche Welle', 'Al Jazeera', 'VOA', 'Voice of America',
  'CNN', 'The Guardian', 'Guardian', 'The New York Times', 'Le Monde',
  'Financial Times', 'The Economist', 'IRIN', 'The New Humanitarian',
  'Le Monde Afrique', 'Politico', 'Politico Africa', 'CNN Africa',
  'Deutsche Welle Afrique', 'RFI Afrique', 'BBC World Service Africa',
  'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
  'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',
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
  'ICG Sahel', 'GRIP', "Groupe de Recherche et d'Information sur la Paix",
  'EcoFin Agency', 'Ecofin', 'Agence Ecofin', 'Apanews', 'APA',
  'FBC', 'Fana Broadcasting', 'Fana Broadcasting Corporate',
  'ENA', 'Ethiopian News Agency', 'Suna', 'Sudan News Agency',
  'APS', 'Algeria Press Service', 'Guinée News', 'Info Congo', 'ADIAC', 'Mada Masr',
  'Zitamar', 'Zitamar News', 'NewsDay', 'NewsDay Zimbabwe',
  '263Chat', 'Standard Gazette', 'Standard Gazette Nigeria',
  'Nation Media', 'Nation Media Group', 'Daily Trust Nigeria',
  'Jeune Afrique', 'Africa Intelligence', 'The Africa Report',
  'Fraternité Matin', "L'Observateur Paalga", 'Le Quotidien', "L'Essor",
  'Cameroon Tribune', 'Gabon Matin', 'Le Pays', 'Sidwaya',
  'Notre Voie', 'Le Patriote', 'Le Débat', 'WakatSéra', 'LeFaso.net',
  "Aujourd'hui", 'Le Soleil', 'Sud Quotidien', 'WalFadjri',
  'EnQuête', 'Libération', "L'Observateur", 'La Tribune',
  'Le Mandat', "L'Intelligent d'Abidjan", 'Soir Info', 'Le Jour',
  'Mutations', "L'Union", 'Gabon Review', 'TchadInfos',
  'Alwihda Info', 'Journal du Tchad', 'Le Progrès',
  'Togolese Press Agency', 'Agence Togolaise de Presse',
  'Le Togolais', 'Le Canard Déchaîné', 'Le Démocrate',
  'El Watan', 'Hespress', 'Le Matin', 'TelQuel', 'Le Point Afrique',
  'HuffPost Maroc', 'Le360', 'Médias24', "L'Économiste", 'La Vie Éco',
  'Liberté', "Le Quotidien d'Oran", 'El Moudjahid', 'Horizons',
  "L'Expression", 'El Khabar', 'Ennahar', 'TSA', "Tout sur l'Algérie",
  'Kapitalis', 'Tunisie Numérique', 'Business News', "L'Économiste Maghrébin",
  'Al Ahram', 'Daily News Egypt',
  'Radio Okapi', 'Le Potentiel', 'La Prospérité', 'Le Phare',
  'Digital Congo', 'Le Journal de Brazza', 'Les Dépêches de Brazzaville',
  'Le Patriote', 'Cameroun Info', 'StopBlaBlaCam',
  'Journal du Cameroun', 'Actu Cameroun', 'Médiapart Congo',
  'Centrafrique Libre', 'Corbeau News', 'Ndjamena Hebdo',
  'Tchad 24', 'Le Visionnaire',
  'The Guardian Nigeria', 'Premium Times',
  'Vanguard', 'ThisDay', 'Daily Trust', 'The Nation', 'Leadership',
  'Tribune', 'Nigerian Tribune', 'NDLEA', 'NDLEA Nigeria',
  'Daily Graphic', 'Joy Online', 'Citi FM', 'MyJoyOnline',
  'Daily Observer', 'FrontPage Africa', 'The New Dawn',
  'The Point', 'Standard Times', 'Awoko', 'Concord Times',
  'Sierra Leone Telegraph', 'Politico SL', 'Daily News Liberia',
  'Women Voices Newspaper', 'Heritage', 'The Inquirer', 'Daily Guide',
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
  'The Southern Times', 'ZimEye', 'Daily Trust Nigeria',
  'Le Mauricien', "L'Express Maurice", 'Mauritius Times',
  'Seychelles Nation', 'Seychelles News Agency', 'Madagascar Tribune',
  "L'Express de Madagascar", 'Midi Madagasikara', 'Comores Infos',
  'Al-Watwan',
  'Sahel Security Watch', 'Observatoire Sahélien',
  'NetBlocks', 'Maritime Security', 'Gulf of Guinea Maritime Institute',
  'MENASTREAM', 'Long War Journal', 'Small Wars Journal',
  'War on the Rocks', 'DefenseWeb', 'African Defence Review',
  'Jamestown Foundation', 'Terrorism Monitor', 'CTC Sentinel',
  'Security Council Report', "What's in Blue", 'PassBlue',
  'The Defense Post', 'Military Africa', 'Africa Security Brief',
  'Sahelien.com', 'Sahel Intelligence', 'Maghreb Emergent',
  'Maghreb Intelligence', 'North Africa Post',
  'amaBhungane', 'Africa Uncensored', 'ANCIR', 'CENOZO',
  'Oxpeckers', 'MUSEBA', 'InfoNile', 'HumAngle', 'HumAngle Media',
  'The Elephant', 'The Continent', 'ZAM Magazine', 'Corruption Watch',
  'Code for Africa', 'PesaCheck', 'Africa Check', 'Dubawa',
  'GhanaFact', 'ZimFact', 'Bohyeba',
  'Météo France', 'AccuWeather', 'The Weather Channel',
  'Météo Algérie', 'Météo Tunisie', 'SAWS', 'South African Weather Service',
  'Climate Home News', 'Carbon Brief', 'Mongabay Africa',
  'China Dialogue', 'Africa Climate Reports',
  'Bloomberg Africa', 'Ecofin Agency', 'Business Day',
  'Business Daily Africa', 'Financial Afrik', 'African Business',
  'African Banker', 'Forbes Africa', 'How We Made It In Africa',
  'Quartz Africa', 'TechCabal', 'Disrupt Africa', 'Ventures Africa',
  'The Exchange Africa', 'African Markets', 'East African Business Week',
  'West Africa Business News', 'CNBC Africa', 'Business Insider Africa',
  'NAIROBI Business Monthly',
  'BBC Sport Africa', 'ESPN Africa', 'Supersport',
  'Kawowo Sports', 'Mozzart Sport Kenya',
  'OkayAfrica', 'This Is Africa', 'Afropop Worldwide', 'Africultures',
  'Music In Africa', 'Brittle Paper', 'The Republic',
  'Chimurenga', 'African Arguments', 'Africa Is a Country',
  'Africa CDC', 'The Lancet Africa', 'SciDev.Net',
  'Nature Africa', 'Research Professional Africa', 'Alliance for Science',
  'Malaria Consortium', 'Amref Health Africa', 'Wellcome Africa',
  'Africa Health Business',
  'Africa Radio', 'Radio France Internationale', 'BBC World Service Africa',
  'Deutsche Welle Afrique', 'VOA Africa', 'China Radio International',
  'Radio Vatican Afrique', 'RFI Afrique', 'Africa No 1', 'Média Afrique',
  'Jornal de Angola', 'Angola Press', 'ANGOP', 'O País', 'Notícias',
  'A Semana', 'Expresso das Ilhas', 'Jornal de São Tomé',
  'Téla Nón', 'DW África',
  'Guinea Ecuatorial Press', 'Diario Rombe', 'Ahora EG',
  'El País Planeta Futuro', 'Mundo Negro',
  'African Law Matters', 'Democracy in Africa', 'Africa Blogging',
  'The Conversation Africa', 'Global Voices Africa',
  'LSE Africa Blog', 'Oxford Africa', 'SOAS Africa',
  'ASC Leiden', 'Nordic Africa Institute',
  'Business Magazine Maurice', 'Observatoire Volcanologique du Karthala',
  'France Info Mayotte', 'Seychelles Broadcasting Corporation', 'SBC',
  'Comores Infos', 'Al-Watwan', 'Comores Infos',
  'Zambia Reports', 'Chimp Reports', 'Libya Observer', 'InfoMigrants',
  'Eye Radio', 'Sahara Médias', 'République Togolaise', 'Togo-Presse',
  'Seychelles Nation', 'Seychelles Broadcasting Corporation',
];

const officialSources = new Set([
  'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
  'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',
  'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP',
  'Africa CDC', 'ACLED',
]);

const stopWords = new Set([
  'dans', 'pour', 'avec', 'sur', 'une', 'des', 'est', 'les', 'pas', 'que',
  'qui', 'aux', 'the', 'and', 'for', 'has', 'was', 'its', 'from', 'with',
  'this', 'that', 'have', 'been', 'were', 'said', 'will', 'not', 'are',
  'but', 'all', 'can', 'had', 'one', 'our', 'his', 'her', 'their', 'them',
  'also', 'into', 'new', 'over', 'after', 'more', 'some', 'than',
]);

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\sà-ü]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));
}

function isKnownSource(source: string): boolean {
  const s = source.toLowerCase().trim();
  return knownSources.some(ks => {
    const ksLower = ks.toLowerCase().trim();
    return s === ksLower || s.includes(ksLower) || ksLower.includes(s);
  });
}

function isOfficialSource(source: string): boolean {
  const s = source.toLowerCase().trim();
  return [...officialSources].some(os => {
    const osLower = os.toLowerCase().trim();
    return s === osLower || s.includes(osLower) || osLower.includes(s);
  });
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

  try {
    const { country, dryRun } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer les feeds à vérifier
    let feedsQuery = supabase
      .from('feeds')
      .select('*')
      .or('source_status.is.null,source_status.eq.unchecked,source_status.eq.warning')
      .order('created_at', { ascending: false })
      .limit(200);

    if (country) {
      feedsQuery = feedsQuery.eq('country', country);
    }

    const { data: feeds, error: fetchError } = await feedsQuery;

    if (fetchError || !feeds) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch feeds',
        detail: fetchError?.message,
      }), { status: 500, headers });
    }

    if (feeds.length === 0) {
      return new Response(JSON.stringify({
        message: 'No unchecked feeds found',
        total: 0,
        results: [],
      }), { headers });
    }

    // Grouper les feeds par pays pour le cross-referencing
    const countryGroups: Record<string, typeof feeds> = {};
    for (const f of feeds) {
      const c = f.country || 'Unknown';
      if (!countryGroups[c]) countryGroups[c] = [];
      countryGroups[c].push(f);
    }

    const results: Array<Record<string, unknown>> = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let rumorCount = 0;

    // Traiter chaque feed
    for (const feed of feeds) {
      let hallucinationScore = 0;
      const flags: string[] = [];
      let sourceStatus: string = 'unchecked';
      let linkCheckError: string | null = null;
      let corroborationCount = 0;

      // --- PHASE 1 : Vivacité URL ---
      let sourceUrlAlive = false;
      if (!feed.source_url || feed.source_url.trim() === '') {
        flags.push('missing_source_url');
        sourceStatus = 'dead';
        linkCheckError = 'URL source absente';
        hallucinationScore += 0.35;
      } else {
        let urlValid = false;
        try {
          const parsedUrl = new URL(feed.source_url.trim());
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            flags.push('invalid_url_protocol');
            sourceStatus = 'dead';
            linkCheckError = 'Protocole URL invalide';
            hallucinationScore += 0.35;
          } else if (parsedUrl.hostname.length < 4) {
            flags.push('suspicious_hostname');
            sourceStatus = 'warning';
            linkCheckError = "Nom d'hôte suspect";
            hallucinationScore += 0.20;
          } else {
            urlValid = true;
          }
        } catch {
          flags.push('malformed_url');
          sourceStatus = 'dead';
          linkCheckError = 'URL mal formée';
          hallucinationScore += 0.35;
        }

        if (urlValid) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(feed.source_url.trim(), {
              method: 'HEAD',
              signal: controller.signal,
              headers: {
                'User-Agent': 'SentiqS-BatchVerifier/1.0',
                'Accept': 'text/html, application/rss+xml, */*',
              },
            });

            clearTimeout(timeoutId);

            if (response.ok || [301, 302, 303].includes(response.status)) {
              sourceUrlAlive = true;
              sourceStatus = 'active';
            } else if ([429, 503].includes(response.status)) {
              sourceStatus = 'warning';
              linkCheckError = `HTTP ${response.status}`;
              hallucinationScore += 0.20;
              flags.push('source_temporarily_unavailable');
            } else {
              sourceStatus = 'dead';
              linkCheckError = `HTTP ${response.status}`;
              hallucinationScore += 0.35;
              flags.push('dead_link');
            }
          } catch (fetchErr) {
            const errMsg = (fetchErr as Error).message || '';
            if (errMsg.includes('abort') || errMsg.includes('timeout')) {
              sourceStatus = 'warning';
              linkCheckError = 'Timeout';
              hallucinationScore += 0.20;
              flags.push('source_timeout');
            } else {
              sourceStatus = 'dead';
              linkCheckError = errMsg.substring(0, 200);
              hallucinationScore += 0.35;
              flags.push('source_unreachable');
            }
          }
        }
      }

      // --- PHASE 2 : Crédibilité source ---
      const sourceKnown = feed.source ? isKnownSource(feed.source) : false;
      const sourceOfficial = feed.source ? isOfficialSource(feed.source) : false;

      if (!sourceKnown && feed.source) {
        hallucinationScore += 0.20;
        flags.push('unknown_source');
      } else if (sourceKnown && !sourceOfficial) {
        hallucinationScore += 0.05;
      }

      // --- PHASE 3 : Cross-referencing ---
      const feedWords = feed.title ? extractKeywords(feed.title) : [];
      const feedWordSet = new Set(feedWords);

      if (feed.country && feedWords.length >= 3) {
        const countryFeeds = countryGroups[feed.country] || [];
        for (const related of countryFeeds) {
          if (related.id === feed.id || !related.title) continue;
          const relatedWords = extractKeywords(related.title);
          if (relatedWords.length < 3) continue;
          const relatedWordSet = new Set(relatedWords);
          const intersection = [...feedWordSet].filter(w => relatedWordSet.has(w)).length;
          const union = new Set([...feedWordSet, ...relatedWordSet]).size;
          const similarity = union > 0 ? intersection / union : 0;
          if (similarity >= 0.25) corroborationCount++;
        }

        if (corroborationCount === 0) {
          hallucinationScore += 0.30;
          flags.push('no_corroboration');
        } else if (corroborationCount === 1) {
          hallucinationScore += 0.15;
          flags.push('single_corroboration');
        }

        if (corroborationCount >= 2) {
          hallucinationScore = Math.max(0, hallucinationScore - 0.12);
        }
      } else {
        hallucinationScore += 0.30;
        flags.push('insufficient_data_for_crossref');
      }

      // --- PHASE 4 : Fraîcheur ---
      if (!feed.verified_at) {
        hallucinationScore += 0.08;
      }

      // Clamp
      hallucinationScore = Math.round(Math.min(1, Math.max(0, hallucinationScore)) * 100) / 100;

      // --- PHASE 5 : Statut ---
      let verificationStatus: string;
      if (sourceStatus === 'dead') {
        verificationStatus = 'rumor';
        hallucinationScore = Math.max(hallucinationScore, 0.70);
      } else if (hallucinationScore < 0.30) {
        verificationStatus = 'verified';
      } else if (hallucinationScore <= 0.60) {
        verificationStatus = 'unverified';
      } else {
        verificationStatus = 'rumor';
      }

      // Stats
      if (verificationStatus === 'verified') verifiedCount++;
      else if (verificationStatus === 'unverified') unverifiedCount++;
      else rumorCount++;

      // Mise à jour DB
      if (!dryRun) {
        await supabase
          .from('feeds')
          .update({
            hallucination_score: hallucinationScore,
            verification_status: verificationStatus,
            source_status: sourceStatus,
            verified_at: new Date().toISOString(),
            last_link_check: new Date().toISOString(),
            link_check_error: linkCheckError,
          })
          .eq('id', feed.id);
      }

      results.push({
        id: feed.id,
        title: feed.title?.substring(0, 80),
        country: feed.country,
        source: feed.source,
        source_url: feed.source_url,
        source_status: sourceStatus,
        verification_status: verificationStatus,
        hallucination_score: hallucinationScore,
        corroboration_count: corroborationCount,
        source_known: sourceKnown,
        source_official: sourceOfficial,
        flags,
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return new Response(JSON.stringify({
      total: feeds.length,
      verified: verifiedCount,
      unverified: unverifiedCount,
      rumor: rumorCount,
      elapsed_seconds: parseFloat(elapsed),
      dry_run: !!dryRun,
      results,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});
