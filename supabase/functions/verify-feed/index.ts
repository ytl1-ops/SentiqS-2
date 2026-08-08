import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

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

    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', feedId)
      .maybeSingle();

    if (fetchError || !feed) {
      return new Response(JSON.stringify({ 
        verified: false, 
        hallucination_score: 1.0,
        reason: fetchError ? 'Fetch error' : 'Feed not found' 
      }), { headers });
    }

    let hallucinationScore = 0.0;
    const flags: string[] = [];

    // 1. Source URL validation
    if (!feed.source_url || feed.source_url.trim() === '') {
      hallucinationScore += 0.5;
      flags.push('missing_source_url');
    } else {
      try {
        const url = new URL(feed.source_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          hallucinationScore += 0.3;
          flags.push('invalid_url_protocol');
        }
        if (url.hostname.length < 4) {
          hallucinationScore += 0.3;
          flags.push('suspicious_hostname');
        }
      } catch {
        hallucinationScore += 0.5;
        flags.push('malformed_url');
      }
    }

    // 2. Source verification against 500+ known reliable sources
    const knownSources = [
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
      'TAP', 'Tunis Afrique Presse', 'APS', 'Algeria Press Service',
      'Guinée News', 'Info Congo', 'ADIAC', 'Mada Masr',
      'Zitamar', 'Zitamar News', 'NewsDay', 'NewsDay Zimbabwe',
      '263Chat', 'Standard Gazette', 'Standard Gazette Nigeria',
      'Nation Media', 'Nation Media Group', 'Daily Trust Nigeria',

      // === AGENCES DE PRESSE INTERNATIONALES (20) ===
      'AFP', 'Agence France-Presse', 'Reuters', 'Associated Press', 'AP', 'Bloomberg',
      'Xinhua', 'EFE', 'ANSA', 'DPA', 'TASS', 'Sputnik', 'Panapress', 'Africa News Agency', 'ANA',
      'PANA', 'Agence Congolaise de Presse', 'ACP', 'Ghana News Agency', 'GNA',

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
      'The Guardian Nigeria', 'Punch Nigeria', 'Premium Times',
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
      'The New Times Rwanda', 'The Citizen', 'Mwananchi',
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
      'The Southern Times', 'ZimEye',
      'NewsDay Zimbabwe', '263Chat', 'Daily Trust Nigeria', 'Standard Gazette',

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

    const sourceNormalized = (feed.source || '').toLowerCase().trim();
    const matched = knownSources.some(s => {
      const sLower = s.toLowerCase().trim();
      return sourceNormalized === sLower || sourceNormalized.includes(sLower) || sLower.includes(sourceNormalized);
    });
    if (!matched && feed.source) {
      hallucinationScore += 0.15;
      flags.push('unknown_source');
    }

    // 3. Geographical consistency check
    const africanCountries = [
      'Burkina Faso', 'Mali', 'Niger', 'Nigeria', 'RDC', 'Cameroun',
      'Côte d\'Ivoire', 'Sénégal', 'Somalie', 'Éthiopie', 'Tchad',
      'Libye', 'Soudan', 'Mozambique', 'Rwanda', 'Burundi', 'Ouganda',
      'Kenya', 'Tanzanie', 'Afrique du Sud', 'Zimbabwe', 'Zambie',
      'Angola', 'Namibie', 'Botswana', 'Madagascar', 'Malawi', 'Lesotho',
      'Eswatini', 'Ghana', 'Guinée', 'Sierra Leone', 'Liberia', 'Gambie',
      'Guinée-Bissau', 'Cap-Vert', 'Centrafrique', 'Congo', 'Gabon',
      'Guinée Équatoriale', 'Sao Tomé-et-Principe', 'Togo', 'Bénin',
      'Maurice', 'Seychelles', 'Comores', 'Djibouti', 'Érythrée',
      'Soudan du Sud', 'Algérie', 'Maroc', 'Tunisie', 'Égypte', 'Mauritanie',
      'Sahara Occidental', 'Afrique', 'Sahel',
    ];

    if (feed.country && !africanCountries.includes(feed.country)) {
      hallucinationScore += 0.3;
      flags.push('non_african_country');
    }

    // 4. Category validation
    const validCategories = [
      'Sécurité', 'Diplomatie', 'Législation', 'Humanitaire', 'Cyber',
      'Économie', 'Politique', 'Environnement', 'Santé', 'Infrastructure',
      'Terrorisme', 'Migration', 'Énergie', 'Défense', 'Agriculture',
      'Commerce', 'Finance', 'Justice', 'Social', 'Éducation', 'Transport',
      'Télécommunications', 'Accident', 'Trafics illicites',
    ];

    if (feed.category && !validCategories.includes(feed.category)) {
      hallucinationScore += 0.1;
      flags.push('unknown_category');
    }

    // Clamp score
    hallucinationScore = Math.min(hallucinationScore, 1.0);
    const verified = hallucinationScore < 0.4;

    // Update feed in database
    const { error: updateError } = await supabase
      .from('feeds')
      .update({ 
        hallucination_score: hallucinationScore,
        verified_at: new Date().toISOString(),
        verification_status: verified ? 'verified' : 'unverified'
      })
      .eq('id', feedId);

    return new Response(JSON.stringify({
      feedId,
      verified,
      hallucination_score: hallucinationScore,
      flags,
      updated: !updateError,
      source_url: feed.source_url,
      source: feed.source,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Internal error', 
      detail: (err as Error).message 
    }), { status: 500, headers });
  }
});