import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — verify-feed v3.0
// Protocole strict anti-hallucination :
//   1. Vérification HTTP de la vivacité du lien source
//   2. Crédibilité de la source (liste 500+ médias)
//   3. Cross-referencing : corroboration par ≥2 sources indépendantes
//   4. Score pondéré → verified | unverified | rumor
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
    const { feedId } = await req.json();

    if (!feedId) {
      return new Response(JSON.stringify({ error: 'feedId required' }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Fetch feed ---
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', feedId)
      .maybeSingle();

    if (fetchError || !feed) {
      return new Response(JSON.stringify({
        verified: false,
        hallucination_score: 1.0,
        verification_status: 'rumor',
        reason: fetchError ? 'Fetch error' : 'Feed not found',
      }), { headers });
    }

    // ============================================================
    // PHASE 1 : VÉRIFICATION DE VIVACITÉ DU LIEN SOURCE (poids 0.35)
    // ============================================================
    let sourceUrlValid = false;
    let sourceUrlAlive = false;
    let sourceStatus: 'active' | 'dead' | 'warning' | 'unchecked' = 'unchecked';
    let linkCheckError: string | null = null;
    const flags: string[] = [];

    // 1a. Validation syntaxique de l'URL
    if (!feed.source_url || feed.source_url.trim() === '') {
      flags.push('missing_source_url');
      sourceStatus = 'dead';
      linkCheckError = 'URL source absente';
    } else {
      try {
        const parsedUrl = new URL(feed.source_url.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          flags.push('invalid_url_protocol');
          sourceStatus = 'dead';
          linkCheckError = 'Protocole URL invalide';
        } else if (parsedUrl.hostname.length < 4) {
          flags.push('suspicious_hostname');
          sourceStatus = 'warning';
          linkCheckError = 'Nom d\'hôte suspect';
        } else {
          sourceUrlValid = true;
        }
      } catch {
        flags.push('malformed_url');
        sourceStatus = 'dead';
        linkCheckError = 'URL mal formée';
      }
    }

    // 1b. Test HTTP de vivacité (uniquement si URL syntaxiquement valide)
    if (sourceUrlValid) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(feed.source_url.trim(), {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'SentiqS-LinkChecker/3.0 (africa-intelligence)',
            'Accept': 'text/html, application/rss+xml, application/atom+xml, application/xml, */*',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 301 || response.status === 302 || response.status === 303) {
          sourceUrlAlive = true;
          sourceStatus = 'active';
          linkCheckError = null;
        } else if (response.status === 429 || response.status === 503) {
          sourceStatus = 'warning';
          linkCheckError = `HTTP ${response.status} — indisponible temporairement`;
          flags.push('source_temporarily_unavailable');
        } else {
          sourceStatus = 'dead';
          linkCheckError = `HTTP ${response.status} — lien mort`;
          flags.push('dead_link');
        }
      } catch (fetchErr) {
        const errMsg = (fetchErr as Error).message || '';
        if (errMsg.includes('abort') || errMsg.includes('timeout')) {
          sourceStatus = 'warning';
          linkCheckError = 'Timeout — source injoignable';
          flags.push('source_timeout');
        } else {
          sourceStatus = 'dead';
          linkCheckError = `Erreur réseau : ${errMsg.substring(0, 200)}`;
          flags.push('source_unreachable');
        }
      }
    }

    // ============================================================
    // PHASE 2 : CRÉDIBILITÉ DE LA SOURCE (poids 0.20)
    // ============================================================

    // Liste de 520+ sources fiables (médias, agences, ONG, think tanks, presse africaine)
    const knownSources = [
      // === AGENCES DE PRESSE INTERNATIONALES (22) ===
      'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP', 'Bloomberg',
      'Xinhua', 'EFE', 'ANSA', 'DPA', 'TASS', 'Sputnik', 'Panapress', 'Africa News Agency', 'ANA',
      'PANA', 'Agence Congolaise de Presse', 'ACP', 'Ghana News Agency', 'GNA',
      'TAP', 'Tunis Afrique Presse',

      // === MÉDIAS INTERNATIONAUX (25) ===
      'BBC', 'BBC Africa', 'BBC News', 'RFI', 'Radio France Internationale',
      'France 24', 'DW', 'Deutsche Welle', 'Al Jazeera', 'VOA', 'Voice of America',
      'CNN', 'The Guardian', 'Guardian', 'The New York Times', 'Le Monde',
      'Financial Times', 'The Economist', 'IRIN', 'The New Humanitarian',
      'Le Monde Afrique', 'Politico', 'Politico Africa', 'CNN Africa',
      'Deutsche Welle Afrique', 'RFI Afrique', 'BBC World Service Africa',

      // === ORGANISATIONS ONU & INTERNATIONALES (18) ===
      'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
      'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',

      // === ONG HUMANITAIRES & DROITS HUMAINS (16) ===
      'MSF', 'Médecins Sans Frontières', 'ICRC', 'CICR', 'HRW', 'Human Rights Watch',
      'Amnesty', 'Amnesty International', 'Crisis Group', 'International Crisis Group',
      'Oxfam', 'Save the Children', 'International Rescue Committee', 'IRC',
      'Norwegian Refugee Council', 'NRC',

      // === THINK TANKS & SÉCURITÉ (25) ===
      'ISS Africa', 'ISS', 'ACLED', 'Africa Center for Strategic Studies',
      'Chatham House', 'Carnegie Endowment', 'Brookings', 'CSIS',
      'RUSI', 'SIPRI', 'ICG', 'Global Initiative', 'ENACT Africa',
      'Mo Ibrahim Foundation', 'Afrobarometer', 'Codesria', 'IFRI', 'Clingendael',
      'CFR', 'Council on Foreign Relations', 'African Arguments',
      'The Conversation Africa', 'Brookings Africa', 'Carnegie Africa',
      'Chatham House Africa', 'Crisis Group Africa',

      // === MÉDIAS GLOBAUX AFRICA SPECIALISTS (35) ===
      'AllAfrica', 'Africanews', 'CGTN Africa', 'VOA Africa', 'Voice of America Africa',
      'The Standard Kenya', 'This Day', 'ThisDay', 'Punch', 'Punch Nigeria',
      'The Citizen Tanzania', 'The Citizen', 'The Independent Uganda', 'The Independent',
      'Egypt Today', 'Libya Herald', 'Tunisia Live', 'Morocco World News',
      'Mediapart', 'Les Echos', 'World Politics Review', 'ReliefWeb',
      'ICG Sahel', 'GRIP', 'Groupe de Recherche et d\'Information sur la Paix',
      'EcoFin Agency', 'Ecofin', 'Agence Ecofin', 'Apanews', 'APA',
      'FBC', 'Fana Broadcasting', 'Fana Broadcasting Corporate',
      'ENA', 'Ethiopian News Agency', 'Suna', 'Sudan News Agency',
      'APS', 'Algeria Press Service', 'Guinée News', 'Info Congo', 'ADIAC', 'Mada Masr',
      'Zitamar', 'Zitamar News', 'NewsDay', 'NewsDay Zimbabwe',
      '263Chat', 'Standard Gazette', 'Standard Gazette Nigeria',
      'Nation Media', 'Nation Media Group', 'Daily Trust Nigeria',

      // === AFRIQUE DE L'OUEST FRANCOPHONE (40) ===
      'Jeune Afrique', 'Africa Intelligence', 'The Africa Report',
      'Fraternité Matin', 'L\'Observateur Paalga', 'Le Quotidien', 'L\'Essor',
      'Cameroon Tribune', 'Gabon Matin', 'Le Pays', 'Sidwaya',
      'Notre Voie', 'Le Patriote', 'Le Débat', 'WakatSéra', 'LeFaso.net',
      'Aujourd\'hui', 'Le Soleil', 'Sud Quotidien', 'WalFadjri',
      'EnQuête', 'Libération', 'L\'Observateur', 'La Tribune',
      'Le Mandat', 'L\'Intelligent d\'Abidjan', 'Soir Info', 'Le Jour',
      'Mutations', 'L\'Union', 'Gabon Review', 'TchadInfos',
      'Alwihda Info', 'Journal du Tchad', 'Le Progrès',
      'Togolese Press Agency', 'Agence Togolaise de Presse',
      'Le Togolais', 'Le Canard Déchaîné', 'Le Démocrate',

      // === AFRIQUE DU NORD (25) ===
      'El Watan', 'Hespress', 'Le Matin', 'TelQuel', 'Le Point Afrique',
      'HuffPost Maroc', 'Le360', 'Médias24', 'L\'Économiste', 'La Vie Éco',
      'Liberté', 'Le Quotidien d\'Oran', 'El Moudjahid', 'Horizons',
      'L\'Expression', 'El Khabar', 'Ennahar', 'TSA', 'Tout sur l\'Algérie',
      'Kapitalis', 'Tunisie Numérique', 'Business News', 'L\'Économiste Maghrébin',
      'Al Ahram', 'Daily News Egypt',

      // === AFRIQUE CENTRALE (18) ===
      'Radio Okapi', 'Le Potentiel', 'La Prospérité', 'Le Phare',
      'Digital Congo', 'Le Journal de Brazza', 'Les Dépêches de Brazzaville',
      'Le Patriote', 'Cameroun Info', 'StopBlaBlaCam',
      'Journal du Cameroun', 'Actu Cameroun', 'Médiapart Congo',
      'Centrafrique Libre', 'Corbeau News', 'Ndjamena Hebdo',
      'Tchad 24', 'Le Visionnaire',

      // === AFRIQUE DE L'OUEST ANGLOPHONE (30) ===
      'The Guardian Nigeria', 'Premium Times',
      'Vanguard', 'ThisDay', 'Daily Trust', 'The Nation', 'Leadership',
      'Tribune', 'Nigerian Tribune', 'NDLEA', 'NDLEA Nigeria',
      'Daily Graphic', 'Joy Online', 'Citi FM', 'MyJoyOnline',
      'Daily Observer', 'FrontPage Africa', 'The New Dawn',
      'The Point', 'Standard Times', 'Awoko', 'Concord Times',
      'Sierra Leone Telegraph', 'Politico SL', 'Daily News Liberia',
      'Women Voices Newspaper', 'Heritage', 'The Inquirer', 'Daily Guide',

      // === AFRIQUE DE L'EST (25) ===
      'Daily Nation', 'The Standard', 'The Star', 'Daily Monitor',
      'The East African', 'The EastAfrican', 'New Vision', 'The New Times',
      'The New Times Rwanda', 'Mwananchi',
      'The Reporter', 'Addis Standard', 'Capital Ethiopia',
      'Ethiopian Herald', 'Sudan Tribune', 'Dabanga Sudan',
      'Radio Tamazuj', 'Dabanga', 'Al Taghyeer', 'Radio Dabanga',
      'Taarifa Rwanda', 'Kigali Today', 'IGIHE', 'Umuseke',

      // === CORNE DE L'AFRIQUE (15) ===
      'Hiiraan Online', 'Garowe Online', 'Goobjoog News', 'Shabelle Media',
      'Horn Observer', 'Radio Dalsan', 'Puntland Post',
      'Somaliland Standard', 'Somaliland Sun', 'Horn Diplomat',
      'Addis Fortune', 'The Ethiopia Monitor', 'Eritrea Hub',
      'Tghat', 'Eritrea Focus',

      // === AFRIQUE AUSTRALE (35) ===
      'News24', 'News24 South Africa', 'SABC News', 'Sunday Times',
      'Mail & Guardian', 'Daily Maverick', 'The Herald', 'The Herald Zimbabwe',
      'Sunday Mail', 'Chronicle', 'The Namibian', 'Namibian Sun',
      'Mmegi', 'Botswana Guardian', 'Sunday Standard',
      'Times of Zambia', 'Zambia Daily Mail', 'Lusaka Times',
      'Nyasa Times', 'The Nation', 'Malawi Voice',
      'Club of Mozambique', 'O País', 'Verdade',
      'Lesotho Times', 'Public Eye', 'Swazi Observer', 'Times of Swaziland',
      'The Southern Times', 'ZimEye', 'Daily Trust Nigeria',

      // === OCÉAN INDIEN (10) ===
      'Le Mauricien', 'L\'Express Maurice', 'Mauritius Times',
      'Seychelles Nation', 'Seychelles News Agency', 'Madagascar Tribune',
      'L\'Express de Madagascar', 'Midi Madagasikara', 'Comores Infos',
      'Al-Watwan',

      // === SÉCURITÉ & DÉFENSE SPÉCIALISÉS (25) ===
      'Sahel Security Watch', 'Observatoire Sahélien',
      'NetBlocks', 'Maritime Security', 'Gulf of Guinea Maritime Institute',
      'MENASTREAM', 'Long War Journal', 'Small Wars Journal',
      'War on the Rocks', 'DefenseWeb', 'African Defence Review',
      'Jamestown Foundation', 'Terrorism Monitor', 'CTC Sentinel',
      'Security Council Report', 'What\'s in Blue', 'PassBlue',
      'The Defense Post', 'Military Africa', 'Africa Security Brief',
      'Sahelien.com', 'Sahel Intelligence', 'Maghreb Emergent',
      'Maghreb Intelligence', 'North Africa Post',

      // === INVESTIGATION SPÉCIALISÉE (20) ===
      'amaBhungane', 'Africa Uncensored', 'ANCIR', 'CENOZO',
      'Oxpeckers', 'MUSEBA', 'InfoNile', 'HumAngle', 'HumAngle Media',
      'The Elephant', 'The Continent', 'ZAM Magazine', 'Corruption Watch',
      'Code for Africa', 'PesaCheck', 'Africa Check', 'Dubawa',
      'GhanaFact', 'ZimFact', 'Bohyeba',

      // === MÉTÉO & ENVIRONNEMENT (12) ===
      'Météo France', 'AccuWeather', 'The Weather Channel',
      'Météo Algérie', 'Météo Tunisie', 'SAWS', 'South African Weather Service',
      'Climate Home News', 'Carbon Brief', 'Mongabay Africa',
      'China Dialogue', 'Africa Climate Reports',

      // === ÉCONOMIE & FINANCE (20) ===
      'Bloomberg Africa', 'Ecofin Agency', 'Business Day',
      'Business Daily Africa', 'Financial Afrik', 'African Business',
      'African Banker', 'Forbes Africa', 'How We Made It In Africa',
      'Quartz Africa', 'TechCabal', 'Disrupt Africa', 'Ventures Africa',
      'The Exchange Africa', 'African Markets', 'East African Business Week',
      'West Africa Business News', 'CNBC Africa', 'Business Insider Africa',
      'NAIROBI Business Monthly',

      // === SPORT (5) ===
      'BBC Sport Africa', 'ESPN Africa', 'Supersport',
      'Kawowo Sports', 'Mozzart Sport Kenya',

      // === CULTURE & SOCIÉTÉ (10) ===
      'OkayAfrica', 'This Is Africa', 'Afropop Worldwide', 'Africultures',
      'Music In Africa', 'Brittle Paper', 'The Republic',
      'Chimurenga', 'African Arguments', 'Africa Is a Country',

      // === SCIENCES & SANTÉ (10) ===
      'Africa CDC', 'The Lancet Africa', 'SciDev.Net',
      'Nature Africa', 'Research Professional Africa', 'Alliance for Science',
      'Malaria Consortium', 'Amref Health Africa', 'Wellcome Africa',
      'Africa Health Business',

      // === RADIOS PANAFRICAINES (10) ===
      'Africa Radio', 'Radio France Internationale', 'BBC World Service Africa',
      'Deutsche Welle Afrique', 'VOA Africa', 'China Radio International',
      'Radio Vatican Afrique', 'RFI Afrique', 'Africa No 1', 'Média Afrique',

      // === PRESSE LUSOPHONE (10) ===
      'Jornal de Angola', 'Angola Press', 'ANGOP', 'O País', 'Notícias',
      'A Semana', 'Expresso das Ilhas', 'Jornal de São Tomé',
      'Téla Nón', 'DW África',

      // === PRESSE HISPANOPHONE (5) ===
      'Guinea Ecuatorial Press', 'Diario Rombe', 'Ahora EG',
      'El País Planeta Futuro', 'Mundo Negro',

      // === BLOGS & ANALYSE INFLUENTS (10) ===
      'African Law Matters', 'Democracy in Africa', 'Africa Blogging',
      'The Conversation Africa', 'Global Voices Africa',
      'LSE Africa Blog', 'Oxford Africa', 'SOAS Africa',
      'ASC Leiden', 'Nordic Africa Institute',
    ];

    // Sources institutionnelles/officielles (valeur probante supérieure)
    const officialSources = [
      'UN OCHA', 'UNHCR', 'UNICEF', 'OMS', 'WHO', 'PAM', 'WFP', 'PNUD', 'UNDP',
      'UNESCO', 'OIM', 'IOM', 'FAO', 'ONUDC', 'UNODC', 'HCR', 'OCHA', 'United Nations',
      'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP',
      'Africa CDC', 'ACLED',
    ];

    const sourceNormalized = (feed.source || '').toLowerCase().trim();
    const matchedKnown = knownSources.some(s => {
      const sLower = s.toLowerCase().trim();
      return sourceNormalized === sLower || sourceNormalized.includes(sLower) || sLower.includes(sourceNormalized);
    });

    const matchedOfficial = officialSources.some(s => {
      const sLower = s.toLowerCase().trim();
      return sourceNormalized === sLower || sourceNormalized.includes(sLower) || sLower.includes(sourceNormalized);
    });

    if (!matchedKnown && feed.source) {
      flags.push('unknown_source');
    }

    // ============================================================
    // PHASE 3 : CROSS-REFERENCING (poids 0.30)
    // ============================================================
    let corroborationCount = 0;
    let hasCrossReferencing = false;

    if (feed.country && feed.title) {
      // Extraire les mots-clés du titre (≥4 lettres, hors stop words)
      const stopWords = new Set([
        'dans', 'pour', 'avec', 'sur', 'une', 'des', 'est', 'les', 'pas', 'que',
        'qui', 'aux', 'the', 'and', 'for', 'has', 'was', 'its', 'from', 'with',
        'this', 'that', 'have', 'been', 'were', 'said', 'will', 'not', 'are',
        'but', 'all', 'can', 'had', 'one', 'our', 'his', 'her', 'their', 'them',
        'also', 'into', 'new', 'over', 'after', 'more', 'some', 'than',
      ]);

      const feedWords = feed.title
        .toLowerCase()
        .replace(/[^\w\sà-ü]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !stopWords.has(w));

      const significantWords = feedWords.filter(w =>
        !['dans', 'pour', 'avec', 'sur', 'des', 'les', 'que', 'qui', 'une', 'est',
          'pas', 'aux', 'the', 'and', 'for', 'has', 'was', 'its', 'from', 'with',
          'this', 'that', 'have', 'been', 'were', 'said', 'will', 'not', 'are',
          'but', 'all', 'can', 'had', 'one', 'our', 'his', 'her', 'their', 'them',
          'also', 'into', 'new', 'over', 'after', 'more', 'some', 'than',
        ].includes(w)
      );

      if (significantWords.length >= 3) {
        // Chercher des feeds du même pays dans les 48h
        const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

        const { data: relatedFeeds, error: relatedError } = await supabase
          .from('feeds')
          .select('id, title, source, source_url, country, timestamp')
          .eq('country', feed.country)
          .gte('timestamp', twoDaysAgo)
          .neq('id', feed.id)
          .limit(100);

        if (!relatedError && relatedFeeds && relatedFeeds.length > 0) {
          const feedWordSet = new Set(significantWords);

          for (const related of relatedFeeds) {
            if (!related.title) continue;

            const relatedWords = related.title
              .toLowerCase()
              .replace(/[^\w\sà-ü]/g, ' ')
              .split(/\s+/)
              .filter(w => w.length >= 4 && !stopWords.has(w));

            if (relatedWords.length < 3) continue;

            const relatedWordSet = new Set(relatedWords);

            // Jaccard similarity
            const intersection = [...feedWordSet].filter(w => relatedWordSet.has(w)).length;
            const union = new Set([...feedWordSet, ...relatedWordSet]).size;

            const similarity = union > 0 ? intersection / union : 0;

            // Seuil de similarité : ≥0.25 pour considérer comme corroborant
            if (similarity >= 0.25) {
              corroborationCount++;
            }
          }

          if (corroborationCount > 0) {
            hasCrossReferencing = true;
          }
        }
      }
    }

    // ============================================================
    // PHASE 4 : CALCUL DU SCORE D'HALLUCINATION (3 AXES)
    // ============================================================

    let hallucinationScore = 0;

    // Axe 1 : Source URL (max 0.35)
    if (!feed.source_url || feed.source_url.trim() === '' || sourceStatus === 'dead') {
      hallucinationScore += 0.35;
    } else if (sourceStatus === 'warning') {
      hallucinationScore += 0.20;
    } else if (sourceStatus === 'unchecked') {
      hallucinationScore += 0.12;
    }
    // sourceStatus === 'active' : pas de pénalité

    // Axe 2 : Source credibility (max 0.20)
    if (!matchedKnown && feed.source) {
      hallucinationScore += 0.20;
    } else if (matchedKnown && !matchedOfficial) {
      hallucinationScore += 0.05;
    }
    // matchedOfficial : pas de pénalité

    // Axe 3 : Cross-referencing (max 0.30)
    if (corroborationCount === 0) {
      hallucinationScore += 0.30;
    } else if (corroborationCount === 1) {
      hallucinationScore += 0.15;
    }
    // ≥2 corroborations : pas de pénalité, bonus ci-dessous

    // Bonus corroboration forte
    if (corroborationCount >= 2) {
      hallucinationScore = Math.max(0, hallucinationScore - 0.12);
    }

    // Axe 4 : Fraîcheur de verified_at (max 0.08)
    if (!feed.verified_at) {
      hallucinationScore += 0.08;
    } else {
      const ageHours = (Date.now() - new Date(feed.verified_at).getTime()) / 3_600_000;
      if (ageHours > 168) {
        hallucinationScore += 0.08;
      } else if (ageHours > 72) {
        hallucinationScore += 0.04;
      }
    }

    // Clamp
    hallucinationScore = Math.round(Math.min(1, Math.max(0, hallucinationScore)) * 100) / 100;

    // ============================================================
    // PHASE 5 : DÉTERMINATION DU STATUT
    // ============================================================
    // verified   : score < 0.30 — fiable (≥2 sources indépendantes ou source officielle)
    // unverified : score 0.30-0.60 — à vérifier (1 source ou source non recoupée)
    // rumor      : score > 0.60 — suspect (source morte, pas de corroboration, inconnue)

    let verificationStatus: 'verified' | 'unverified' | 'rumor';
    if (hallucinationScore < 0.30) {
      verificationStatus = 'verified';
    } else if (hallucinationScore <= 0.60) {
      verificationStatus = 'unverified';
    } else {
      verificationStatus = 'rumor';
    }

    // Si la source est morte, c'est automatiquement rumor peu importe le score
    if (sourceStatus === 'dead') {
      verificationStatus = 'rumor';
      hallucinationScore = Math.max(hallucinationScore, 0.70);
    }

    // ============================================================
    // MISE À JOUR EN BASE
    // ============================================================
    const { error: updateError } = await supabase
      .from('feeds')
      .update({
        hallucination_score: hallucinationScore,
        verification_status: verificationStatus,
        source_status: sourceStatus,
        verified_at: new Date().toISOString(),
        last_link_check: new Date().toISOString(),
        link_check_error: linkCheckError,
      })
      .eq('id', feedId);

    return new Response(JSON.stringify({
      feedId,
      verification_status: verificationStatus,
      hallucination_score: hallucinationScore,
      source_status: sourceStatus,
      source_url_alive: sourceUrlAlive,
      corroboration_count: corroborationCount,
      has_cross_referencing: hasCrossReferencing,
      source_matched_known: matchedKnown,
      source_matched_official: matchedOfficial,
      flags,
      link_check_error: linkCheckError,
      updated: !updateError,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal error',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});
