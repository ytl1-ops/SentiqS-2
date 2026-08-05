import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CountryOperationalPanelProps {
  countryName: string;
  countryCode: string;
  level: string;
}

interface OperationalContact {
  type: string;
  name: string;
  phone: string;
  hours: string;
}

interface HospitalRef {
  name: string;
  city: string;
  type: string;
  phone: string;
  evacuation: boolean;
}

interface NoGoZone {
  name: string;
  reason: string;
  since: string;
}

const OPERATIONAL_DATA: Record<string, {
  contacts: OperationalContact[];
  hospitals: HospitalRef[];
  noGoZones: NoGoZone[];
  curfew: string | null;
  checkpoints: string[];
}> = {
  ML: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Bamako', phone: '+223 44 97 59 59', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central', phone: '17 / 8000 1117', hours: '24/7' },
      { type: 'Protection Civile', name: 'DGPC Mali', phone: '18 / 8000 1118', hours: '24/7' },
      { type: 'MEDEVAC', name: 'Centre Médical ISOS', phone: '+223 76 12 34 56', hours: '24/7 — coordination évacuation' },
    ],
    hospitals: [
      { name: 'Hôpital du Mali', city: 'Bamako', type: 'Hôpital général', phone: '+223 20 22 50 20', evacuation: true },
      { name: 'Clinique Pasteur', city: 'Bamako', type: 'Clinique privée', phone: '+223 20 22 52 27', evacuation: false },
      { name: 'Hôpital Gabriel Touré', city: 'Bamako', type: 'CHU', phone: '+223 20 22 20 32', evacuation: false },
      { name: 'Hôpital Sominé Dolo', city: 'Mopti', type: 'Hôpital régional', phone: '+223 21 42 01 21', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région de Kidal', reason: 'Présence groupes armés, risque enlèvement', since: '2012' },
      { name: 'Zone des 3 frontières (Gao)', reason: 'Activité terroriste intense — JNIM, EIGS', since: '2015' },
      { name: 'Forêt de Faya', reason: 'Sanctuaire djihadiste', since: '2020' },
    ],
    curfew: 'Couvre-feu minuit-05:00 dans les régions de Mopti, Gao, Tombouctou',
    checkpoints: ['Poste contrôle ACI 2000', 'Checkpoint Route de Koulikoro', 'Barrage Sénou Aéroport'],
  },
  BF: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Ouagadougou', phone: '+226 25 49 66 66', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Ouaga', phone: '17', hours: '24/7' },
      { type: 'Protection Civile', name: 'Brigade des Sapeurs-Pompiers', phone: '18', hours: '24/7' },
    ],
    hospitals: [
      { name: 'CHU Yalgado Ouédraogo', city: 'Ouagadougou', type: 'CHU', phone: '+226 25 31 16 55', evacuation: true },
      { name: 'Clinique Les Genêts', city: 'Ouagadougou', type: 'Clinique privée', phone: '+226 25 36 09 09', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région du Sahel', reason: 'Attaques terroristes récurrentes — JNIM, EIGS', since: '2018' },
      { name: 'Province du Soum', reason: 'Zone rouge — déplacements interdits', since: '2019' },
      { name: 'Province du Seno', reason: 'Risque élevé d\'embuscade', since: '2020' },
    ],
    curfew: 'Couvre-feu 21:00-05:00 dans les régions du Nord, Sahel, Est',
    checkpoints: ['Poste contrôle Ouaga 2000', 'Barrage Ziniaré', 'Checkpoint Ouaga-Ouahigouya'],
  },
  NE: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Niamey', phone: '+227 20 72 24 31', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Niamey', phone: '17', hours: '24/7' },
      { type: 'Protection Civile', name: 'Protection Civile Niger', phone: '18', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Hôpital National de Niamey', city: 'Niamey', type: 'Hôpital national', phone: '+227 20 72 21 21', evacuation: true },
      { name: 'Hôpital Général de Référence', city: 'Niamey', type: 'Hôpital général', phone: '+227 20 72 21 22', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région de Diffa', reason: 'Boko Haram, attaques transfrontalières', since: '2015' },
      { name: 'Région de Tillabéri (rive droite)', reason: 'EIGS, JNIM — kidnappings d\'expatriés', since: '2019' },
      { name: 'Région de Tahoua (nord)', reason: 'Incursions groupes armés depuis le Mali', since: '2020' },
    ],
    curfew: 'Couvre-feu 22:00-05:00 dans les régions de Tillabéri, Diffa',
    checkpoints: ['Poste entrée Niamey Goudel', 'Barrage Route de Say', 'Checkpoint Niamey-Dosso'],
  },
  CD: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Kinshasa', phone: '+243 81 880 44 11', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'MONUSCO', name: 'Poste de commandement sécurité', phone: '+243 81 890 50 00', hours: '24/7' },
      { type: 'Police RDC', name: 'Commissariat Provincial', phone: '112', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Hôpital du Cinquantenaire', city: 'Kinshasa', type: 'Hôpital général', phone: '+243 99 78 24 000', evacuation: true },
      { name: 'Clinique Ngaliema', city: 'Kinshasa', type: 'Clinique privée', phone: '+243 81 81 18 000', evacuation: false },
      { name: 'Hôpital Général de Goma', city: 'Goma', type: 'Hôpital régional', phone: '+243 99 43 94 000', evacuation: true },
    ],
    noGoZones: [
      { name: 'Nord-Kivu (zones M23)', reason: 'Conflit armé actif — M23, déplacements massifs', since: '2022' },
      { name: 'Ituri', reason: 'Violence intercommunautaire, groupes armés', since: '2018' },
      { name: 'Province du Tanganyika', reason: 'Conflits interethniques, milices Twa', since: '2016' },
    ],
    curfew: 'Aucun couvre-feu officiel à Kinshasa. Restrictions nocturnes dans le Nord-Kivu.',
    checkpoints: ['Poste contrôle N\'Djili Aéroport', 'Barrage Route des Poids Lourds', 'Checkpoint Boulevard du 30 Juin'],
  },
  SO: {
    contacts: [
      { type: 'UNSOM', name: 'Quartier Général Sécurité', phone: '+252 61 200 00 00', hours: '24/7' },
      { type: 'AMISOM/ATMIS', name: 'Poste de liaison sécurité', phone: '+252 61 700 00 00', hours: '24/7' },
      { type: 'Police Somalienne', name: 'SPF HQ Mogadiscio', phone: '888', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Hôpital Madina', city: 'Mogadiscio', type: 'Hôpital général', phone: '+252 61 55 00 000', evacuation: true },
      { name: 'Hôpital Keysaney', city: 'Mogadiscio', type: 'Hôpital Croix-Rouge', phone: '+252 61 70 00 000', evacuation: true },
    ],
    noGoZones: [
      { name: 'Sud de la Somalie', reason: 'Al-Shabaab — attaques, IED, assassinats ciblés', since: '2006' },
      { name: 'Région de Bakool', reason: 'Zone de combat — famine, insécurité', since: '2011' },
      { name: 'Puntland (zones frontalières)', reason: 'Conflits claniques, piraterie résiduelle', since: '2010' },
    ],
    curfew: 'Couvre-feu nocturne à Mogadiscio 22:00-05:00. Zones Al-Shabaab: restrictions totales.',
    checkpoints: ['Poste entrée Aden Adde Airport', 'Checkpoint KM4', 'Barrage Waberi'],
  },
  TD: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire N\'Djamena', phone: '+235 22 52 25 75', hours: 'Lun-Jeu 08:00-16:00, Ven 08:00-13:00' },
      { type: 'Police Nationale', name: 'Commissariat Central N\'Djamena', phone: '17 / +235 22 52 33 33', hours: '24/7' },
      { type: 'Protection Civile', name: 'Corps des Sapeurs-Pompiers', phone: '18', hours: '24/7' },
      { type: 'MEDEVAC', name: 'Centre Médico-Social Ambassade France', phone: '+235 66 29 00 00', hours: '24/7 — coordination évacuation sanitaire' },
    ],
    hospitals: [
      { name: 'Hôpital Général de Référence Nationale', city: 'N\'Djamena', type: 'Hôpital national', phone: '+235 22 52 33 33', evacuation: true },
      { name: 'Hôpital de la Renaissance', city: 'N\'Djamena', type: 'Hôpital général', phone: '+235 22 52 44 44', evacuation: false },
      { name: 'Centre Hospitalier La Rose', city: 'N\'Djamena', type: 'Clinique privée', phone: '+235 66 28 00 01', evacuation: false },
      { name: 'Hôpital Régional de Moundou', city: 'Moundou', type: 'Hôpital régional', phone: '+235 22 69 11 22', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région du Lac Tchad (rive nord)', reason: 'Incursions Boko Haram, risque d\'enlèvement — zone rouge formelle', since: '2015' },
      { name: 'Province du Kanem (zone frontalière)', reason: 'Banditisme armé transfrontalier, trafics', since: '2019' },
      { name: 'Zone frontalière soudanaise (Est)', reason: 'Afflux de réfugiés armés, instabilité liée au conflit soudanais', since: '2023' },
    ],
    curfew: 'Couvre-feu 00:00-05:00 dans la région du Lac. Restrictions de circulation nocturne sur l\'axe N\'Djamena-Bol.',
    checkpoints: ['Poste contrôle Aéroport Hassan Djamous', 'Barrage Pont de Chagoua', 'Checkpoint Route de Farcha'],
  },
  GN: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Conakry', phone: '+224 621 35 00 10', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Kaloum', phone: '117 / +224 622 22 22 22', hours: '24/7' },
      { type: 'Protection Civile', name: 'Service National d\'Action Humanitaire', phone: '18 / +224 622 23 23 23', hours: '24/7' },
      { type: 'MEDEVAC', name: 'Centre Médical ISOS Conakry', phone: '+224 621 00 11 22', hours: '24/7 — coordination évacuation' },
    ],
    hospitals: [
      { name: 'Hôpital National Donka', city: 'Conakry', type: 'CHU', phone: '+224 622 35 00 00', evacuation: true },
      { name: 'Hôpital de l\'Amitié Sino-Guinéenne', city: 'Conakry', type: 'Hôpital général', phone: '+224 622 40 00 00', evacuation: false },
      { name: 'Clinique Pasteur', city: 'Conakry', type: 'Clinique privée', phone: '+224 622 41 00 00', evacuation: true },
      { name: 'Hôpital Régional de Kankan', city: 'Kankan', type: 'Hôpital régional', phone: '+224 622 50 11 22', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région forestière (sud Nzérékoré)', reason: 'Tensions intercommunautaires, bandes armées, trafics transfrontaliers', since: '2021' },
      { name: 'Quartiers périphériques de Conakry la nuit', reason: 'Criminalité, braquages, violences urbaines après 22:00', since: '2023' },
      { name: 'Zone frontalière Sierra Leone (Forécariah)', reason: 'Trafic d\'armes légères, contrebande, absence de contrôle étatique', since: '2020' },
    ],
    curfew: 'Pas de couvre-feu officiel. Forte présence militaire à Conakry. Restrictions ponctuelles lors des manifestations.',
    checkpoints: ['Poste contrôle Aéroport Conakry Gbessia', 'Barrage Tombo', 'Checkpoint Autoroute Fidel Castro', 'Poste entrée Port Autonome'],
  },
  CM: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Yaoundé', phone: '+237 222 22 79 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Yaoundé', phone: '17 / 117', hours: '24/7' },
      { type: 'Gendarmerie', name: 'Légion de Gendarmerie Yaoundé', phone: '+237 222 22 12 00', hours: '24/7' },
      { type: 'Protection Civile', name: 'Corps National des Sapeurs-Pompiers', phone: '18 / 118', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Hôpital Central de Yaoundé', city: 'Yaoundé', type: 'CHU', phone: '+237 222 22 00 00', evacuation: true },
      { name: 'Hôpital Laquintinie', city: 'Douala', type: 'Hôpital général', phone: '+237 233 42 00 00', evacuation: true },
      { name: 'Hôpital Général de Bamenda', city: 'Bamenda', type: 'Hôpital régional', phone: '+237 233 36 11 55', evacuation: false },
      { name: 'Centre Hospitalier Universitaire de Maroua', city: 'Maroua', type: 'CHU régional', phone: '+237 222 29 11 22', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région du Nord-Ouest (zones rurales)', reason: 'Conflit armé ambazonien, EEI, enlèvements, affrontements réguliers', since: '2017' },
      { name: 'Région du Sud-Ouest (hors chef-lieu)', reason: 'Groupes séparatistes actifs, embuscades, écoles et personnels ciblés', since: '2017' },
      { name: 'Extrême-Nord (Mayo-Sava, Mayo-Tsanaga)', reason: 'Attaques Boko Haram transfrontalières, villages incendiés, enlèvements', since: '2014' },
      { name: 'Zone frontalière RCA (Est)', reason: 'Incursions rebelles centrafricaines, banditisme armé, trafic d\'armes', since: '2013' },
    ],
    curfew: 'Couvre-feu 20:00-06:00 dans les régions du Nord-Ouest et Sud-Ouest. Restrictions nocturnes dans l\'Extrême-Nord.',
    checkpoints: ['Poste contrôle Aéroport Yaoundé Nsimalen', 'Barrage Mvan', 'Checkpoint Entrée Douala Bonabéri', 'Poste Échangeur Warda'],
  },
  MZ: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Maputo', phone: '+258 21 49 16 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'PRM — Commando Geral Maputo', phone: '119 / +258 21 32 00 10', hours: '24/7' },
      { type: 'Protection Civile', name: 'INGC — Instituto Nacional de Gestão de Calamidades', phone: '+258 21 49 57 62', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS Southern Africa Coordination', phone: '+27 11 921 6100', hours: '24/7 — évacuation vers Johannesburg' },
    ],
    hospitals: [
      { name: 'Hospital Central de Maputo', city: 'Maputo', type: 'Hôpital central', phone: '+258 21 32 00 01', evacuation: true },
      { name: 'Clinica da Cruz Azul', city: 'Maputo', type: 'Clinique privée', phone: '+258 21 49 34 00', evacuation: true },
      { name: 'Hospital Provincial de Pemba', city: 'Pemba', type: 'Hôpital provincial', phone: '+258 27 22 00 01', evacuation: true },
      { name: 'Hospital Rural de Mueda', city: 'Mueda', type: 'Hôpital rural', phone: '+258 27 82 00 44', evacuation: false },
    ],
    noGoZones: [
      { name: 'Province de Cabo Delgado (nord du rio Messalo)', reason: 'Insurrection jihadiste active, décapitations, déplacements massifs, EEI', since: '2017' },
      { name: 'District de Macomia', reason: 'Zone de combat — attaques récurrentes de l\'EIS-Mozambique depuis 2024', since: '2024' },
      { name: 'District de Mocímboa da Praia', reason: 'Ancien fief jihadiste, présence résiduelle, reconstruction sous contrôle militaire', since: '2020' },
    ],
    curfew: 'Pas de couvre-feu national. Restrictions de circulation dans les zones de conflit du Cabo Delgado. Escorte militaire obligatoire sur la route Pemba-Palma.',
    checkpoints: ['Poste contrôle Aéroport Maputo Mavalane', 'Barrage Pont Maputo-Catembe', 'Checkpoint Entrée Nord Pemba', 'Poste sécurité TotalEnergies Afungi'],
  },
  AO: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Luanda', phone: '+244 222 33 22 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Comando Geral da Polícia Nacional', phone: '113 / +244 222 33 00 00', hours: '24/7' },
      { type: 'Protection Civile', name: 'Serviço Nacional de Protecção Civil', phone: '112 / +244 222 33 11 00', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Hospital Josina Machel', city: 'Luanda', type: 'Hôpital central', phone: '+244 222 33 00 01', evacuation: true },
      { name: 'Clínica Girassol', city: 'Luanda', type: 'Clinique privée', phone: '+244 222 44 00 00', evacuation: true },
      { name: 'Clínica Sagrada Esperança', city: 'Luanda', type: 'Clinique privée', phone: '+244 222 33 44 00', evacuation: false },
      { name: 'Hospital Geral do Huambo', city: 'Huambo', type: 'Hôpital régional', phone: '+244 241 22 00 00', evacuation: false },
    ],
    noGoZones: [
      { name: 'Province de Cabinda (zones frontalières)', reason: 'Activité résiduelle FLEC, risque enlèvement personnel expatrié pétrolier', since: '2010' },
      { name: 'Musseques de Luanda la nuit', reason: 'Criminalité violente, braquages, gangs armés après 22:00', since: '2018' },
      { name: 'Province de Lunda Norte (zones diamantifères)', reason: 'Exploitation illégale, groupes armés, trafics transfrontaliers RDC', since: '2015' },
    ],
    curfew: 'Aucun couvre-feu national. Restrictions de circulation dans la province de Cabinda pour le personnel non autorisé. Couvre-feu local possible lors des opérations policières.',
    checkpoints: ['Poste contrôle Aéroport Luanda 4 de Fevereiro', 'Barrage Estrada de Catete', 'Checkpoint Entrée Port de Luanda'],
  },
  NG: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Lagos', phone: '+234 1 462 66 66', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'NPF — Force Headquarters Abuja', phone: '112 / +234 803 330 0000', hours: '24/7' },
      { type: 'Protection Civile', name: 'NEMA — National Emergency Management Agency', phone: '+234 803 330 0001', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS Nigeria Coordination', phone: '+234 1 466 00 00', hours: '24/7 — Lagos & Abuja' },
    ],
    hospitals: [
      { name: 'National Hospital Abuja', city: 'Abuja', type: 'Hôpital national', phone: '+234 803 330 0002', evacuation: true },
      { name: 'Reddington Hospital', city: 'Lagos', type: 'Hôpital privé', phone: '+234 1 271 44 44', evacuation: true },
      { name: 'EKO Hospital', city: 'Lagos', type: 'Hôpital privé', phone: '+234 1 262 11 11', evacuation: false },
      { name: 'University of Maiduguri Teaching Hospital', city: 'Maiduguri', type: 'CHU', phone: '+234 803 330 0003', evacuation: true },
    ],
    noGoZones: [
      { name: 'État de Borno (hors Maiduguri)', reason: 'Insurrection Boko Haram/ISWAP active, EEI, enlèvements de masse', since: '2009' },
      { name: 'État de Zamfara (zones rurales)', reason: 'Banditisme armé, kidnapping contre rançon, écoles ciblées', since: '2018' },
      { name: 'État de Kaduna (axe Abuja-Kaduna)', reason: 'Enlèvements sur la route et le rail, attaques de villages', since: '2020' },
      { name: 'État du Plateau (zones rurales)', reason: 'Violences intercommunautaires éleveurs-agriculteurs, attaques cycliques', since: '2018' },
    ],
    curfew: 'Couvre-feu 18:00-06:00 dans plusieurs LGAs du Borno. Restrictions nocturnes dans les zones à risque des États de Zamfara, Kaduna, Katsina.',
    checkpoints: ['Poste contrôle Aéroport Abuja Nnamdi Azikiwe', 'Barrage Entrée Lagos Island', 'Checkpoint Abuja-Kaduna Expressway', 'Poste sécurité Victoria Island'],
  },
  SD: {
    contacts: [
      { type: 'Ambassade France', name: 'Cellule de crise Khartoum (coordination Paris)', phone: '+33 1 43 17 51 00', hours: '24/7 — téléphone satellitaire prioritaire' },
      { type: 'UNMIS/UNITAMS', name: 'Poste de liaison sécurité ONU Port-Soudan', phone: '+249 91 21 00 000', hours: '24/7' },
      { type: 'Police Soudanaise', name: 'Poste de commandement Port-Soudan', phone: '—', hours: 'Fonctionnement dégradé' },
    ],
    hospitals: [
      { name: 'Hôpital de Port-Soudan', city: 'Port-Soudan', type: 'Hôpital régional', phone: '+249 31 18 22 000', evacuation: true },
      { name: 'Hôpital Al-Naw (MSF)', city: 'Khartoum', type: 'Hôpital MSF', phone: '—', evacuation: true },
      { name: 'Hôpital Al-Buluk (MSF)', city: 'Omdurman', type: 'Hôpital de campagne MSF', phone: '—', evacuation: true },
    ],
    noGoZones: [
      { name: 'Khartoum et Omdurman (zone de combat)', reason: 'Conflit armé actif SAF vs RSF, bombardements quotidiens, snipers', since: '2023' },
      { name: 'Darfour (El Geneina, Nyala, El Fasher)', reason: 'Nettoyage ethnique, massacres documentés, CPI saisie, famine déclarée camp Zamzam', since: '2023' },
      { name: 'État du Nil Bleu', reason: 'Affrontements interethniques, déplacements massifs, insécurité alimentaire extrême', since: '2023' },
    ],
    curfew: 'Couvre-feu permanent de facto dans les zones de conflit. Évacuation totale du personnel non essentiel ordonnée par la plupart des ambassades occidentales.',
    checkpoints: ['Poste contrôle Port-Soudan Aéroport', 'Barrage Entrée Port maritime', 'Checkpoint Route Port-Soudan-Atbara'],
  },
  ET: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Addis-Abeba', phone: '+251 11 140 00 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Fédérale', name: 'Ethiopian Federal Police HQ', phone: '991 / +251 11 155 00 00', hours: '24/7' },
      { type: 'Protection Civile', name: 'EDRMC — Ethiopian Disaster Risk Management Commission', phone: '+251 11 551 00 00', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS Addis-Abeba Coordination', phone: '+251 91 120 00 00', hours: '24/7' },
    ],
    hospitals: [
      { name: 'Tikur Anbessa (Black Lion) Hospital', city: 'Addis-Abeba', type: 'CHU', phone: '+251 11 551 11 11', evacuation: true },
      { name: 'ALERT Hospital', city: 'Addis-Abeba', type: 'Hôpital spécialisé', phone: '+251 11 551 22 22', evacuation: false },
      { name: 'Korean Hospital', city: 'Addis-Abeba', type: 'Hôpital privé', phone: '+251 11 662 00 00', evacuation: true },
      { name: 'Ayder Comprehensive Specialized Hospital', city: 'Mekele', type: 'CHU régional', phone: '+251 34 441 00 00', evacuation: true },
    ],
    noGoZones: [
      { name: 'Région du Tigré (zones frontalières)', reason: 'Tensions post-conflit, mines non déminées, présence militaire lourde', since: '2020' },
      { name: 'Région d\'Oromia (zones ouest)', reason: 'Insurrection OLA, enlèvements, attaques contre civils Amhara, déplacements', since: '2018' },
      { name: 'Région Amhara (zones de conflit)', reason: 'Affrontements FANO vs ENDF, instabilité depuis dissolution forces régionales', since: '2023' },
      { name: 'Région Somali (zone frontalière Somalie)', reason: 'Incursions Al-Shabaab, trafics, sécheresse et tensions pastoralistes', since: '2010' },
    ],
    curfew: 'Pas de couvre-feu national. Restrictions de circulation dans certaines zones de l\'Oromia et de l\'Amhara. État d\'urgence décrété dans la région Amhara en août 2023.',
    checkpoints: ['Poste contrôle Aéroport Addis-Abeba Bole', 'Barrage Entrée Sud Addis', 'Checkpoint Route Addis-Adama', 'Poste sécurité Union Africaine'],
  },
  LY: {
    contacts: [
      { type: 'Ambassade France', name: 'Cellule de crise Paris (coordination)', phone: '+33 1 43 17 51 00', hours: '24/7 — téléphone satellitaire' },
      { type: 'MANUL/UNSMIL', name: 'Quartier Général Sécurité Tripoli', phone: '+218 21 477 00 00', hours: 'Fonctionnement dégradé' },
      { type: 'Protection Civile', name: 'Croissant-Rouge Libyen', phone: '+218 21 333 09 44', hours: 'Irégulier' },
      { type: 'MEDEVAC', name: 'ISOS Malte Coordination', phone: '+356 21 23 45 67', hours: '24/7 — évacuation vers Malte/Rome' },
    ],
    hospitals: [
      { name: 'Tripoli Medical Center', city: 'Tripoli', type: 'Hôpital central', phone: '+218 21 333 00 01', evacuation: true },
      { name: 'Al Khadra Hospital', city: 'Tripoli', type: 'Hôpital général', phone: '+218 21 333 00 02', evacuation: true },
      { name: 'Benghazi Medical Center', city: 'Benghazi', type: 'Hôpital central', phone: '+218 61 222 00 01', evacuation: true },
      { name: 'Misrata Central Hospital', city: 'Misrata', type: 'Hôpital régional', phone: '+218 51 222 00 03', evacuation: false },
    ],
    noGoZones: [
      { name: 'Tripoli (zones de combat actives)', reason: 'Affrontements inter-milices, snipers, tirs de mortier — RADA vs Brigade 444', since: '2024' },
      { name: 'Sud Libye (Fezzan, Koufra)', reason: 'Zone de non-droit, trafics d\'armes et d\'êtres humains, groupes armés incontrôlés', since: '2014' },
      { name: 'Derna et Djebel Akhdar', reason: 'Instabilité post-conflit, mines non déminées, groupes salafistes résiduels', since: '2018' },
    ],
    curfew: 'Couvre-feu total actuellement à Tripoli. Restrictions nocturnes variables selon les zones de contrôle des milices. Tout déplacement non essentiel est fortement déconseillé.',
    checkpoints: ['Poste entrée Aéroport Mitiga (fermé)', 'Barrage Route de l\'Aéroport', 'Checkpoint Abou Slim'],
  },
  CF: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Bangui', phone: '+236 21 61 30 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'MINUSCA', name: 'Centre Opérationnel Sécurité', phone: '+236 21 61 77 77', hours: '24/7' },
      { type: 'Police Nationale', name: 'Commissariat Central Bangui', phone: '—', hours: 'Fonctionnement dégradé' },
      { type: 'MEDEVAC', name: 'ISOS Coordination Bangui', phone: '+236 70 12 34 56', hours: '24/7 — évacuation vers Douala' },
    ],
    hospitals: [
      { name: 'Hôpital Communautaire de Bangui', city: 'Bangui', type: 'Hôpital général', phone: '+236 21 61 00 01', evacuation: true },
      { name: 'Hôpital de l\'Amitié Sino-Centrafricaine', city: 'Bangui', type: 'Hôpital général', phone: '+236 21 61 00 02', evacuation: false },
      { name: 'Hôpital Régional de Bambari', city: 'Bambari', type: 'Hôpital régional — accès limité', phone: '—', evacuation: false },
      { name: 'Base Médicale MINUSCA', city: 'Bangui', type: 'Hôpital militaire ONU', phone: '+236 21 61 77 78', evacuation: true },
    ],
    noGoZones: [
      { name: 'Nord-Est (Haute-Kotto, Vakaga)', reason: 'Zone CPC active, présence Wagner, mines, enlèvements, exactions contre civils', since: '2013' },
      { name: 'Axe Bangui-Bossangoa', reason: 'Embuscades récurrentes, convois humanitaires ciblés, coupeurs de route', since: '2020' },
      { name: 'Ouham-Pendé (frontière tchadienne)', reason: 'Transhumance armée, conflits éleveurs-agriculteurs, banditisme', since: '2018' },
    ],
    curfew: 'Pas de couvre-feu officiel à Bangui. Déplacements hors de la capitale strictement déconseillés sans escorte MINUSCA. Restrictions nocturnes de facto dans les provinces.',
    checkpoints: ['Poste contrôle Aéroport Bangui M\'Poko', 'Barrage PK12', 'Checkpoint Route de Boali', 'Poste Entrée MINUSCA'],
  },
  SS: {
    contacts: [
      { type: 'Ambassade France', name: 'Bureau de liaison Juba', phone: '+211 91 21 00 001', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'UNMISS', name: 'Quartier Général Sécurité Juba', phone: '+211 91 21 00 000', hours: '24/7' },
      { type: 'Police SPLA', name: 'Commissariat Central Juba', phone: '—', hours: 'Fonctionnement irrégulier' },
      { type: 'MEDEVAC', name: 'ISOS East Africa Coordination', phone: '+254 20 699 3000', hours: '24/7 — évacuation vers Nairobi' },
    ],
    hospitals: [
      { name: 'Juba Teaching Hospital', city: 'Juba', type: 'Hôpital universitaire', phone: '+211 91 21 00 002', evacuation: true },
      { name: 'AMREF Flying Doctors Juba', city: 'Juba', type: 'Clinique privée', phone: '+211 91 21 00 003', evacuation: true },
      { name: 'Hôpital MSF Bentiu', city: 'Bentiu', type: 'Hôpital de campagne MSF', phone: '—', evacuation: true },
      { name: 'Malakal Teaching Hospital', city: 'Malakal', type: 'Hôpital régional — capacité dégradée', phone: '—', evacuation: false },
    ],
    noGoZones: [
      { name: 'État du Jonglei (zones rurales)', reason: 'Conflits interethniques Dinka-Nuer actifs, massacres cycliques, villages brûlés', since: '2013' },
      { name: 'État du Haut-Nil (hors Malakal)', reason: 'Famine IPC 4+, insécurité alimentaire extrême, milices armées, inondations', since: '2021' },
      { name: 'État du Lakes (zones de bétail)', reason: 'Raids de bétail armés, enlèvements d\'enfants, violences sexuelles systématiques', since: '2014' },
    ],
    curfew: 'Couvre-feu 22:00-06:00 à Juba. Déplacements hors capitale nécessitent autorisation UNMISS. Situation humanitaire catastrophique dans 65% du territoire.',
    checkpoints: ['Poste contrôle Aéroport Juba International', 'Barrage Pont de Juba', 'Checkpoint Entrée UNMISS Tomping'],
  },
  BJ: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Cotonou', phone: '+229 21 30 02 25', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Républicaine', name: 'Commissariat Central Cotonou', phone: '117 / +229 21 30 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'ANPC — Agence Nationale de Protection Civile', phone: '118 / +229 21 30 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS West Africa Coordination', phone: '+225 27 22 52 00 00', hours: '24/7 — évacuation vers Abidjan' },
    ],
    hospitals: [
      { name: 'CNHU-HKM de Cotonou', city: 'Cotonou', type: 'CHU', phone: '+229 21 30 00 03', evacuation: true },
      { name: 'Clinique Mahouna', city: 'Cotonou', type: 'Clinique privée', phone: '+229 21 30 00 04', evacuation: false },
      { name: 'Hôpital de Zone de Kandi', city: 'Kandi', type: 'Hôpital de zone — capacité réduite', phone: '+229 23 82 00 01', evacuation: true },
      { name: 'Hôpital Saint-Jean de Dieu', city: 'Tanguiéta', type: 'Hôpital confessionnel', phone: '+229 23 83 00 01', evacuation: false },
    ],
    noGoZones: [
      { name: 'Parc national du W et zone tampon', reason: 'Sanctuaire jihadiste actif, attaques récurrentes, IED, embuscades — JNIM', since: '2023' },
      { name: 'Département de l\'Alibori (zones frontalières)', reason: 'Incursions terroristes depuis le Burkina, 15 000 déplacés, raids sur villages', since: '2024' },
      { name: 'Département de l\'Atacora (ouest)', reason: 'Expansion menace jihadiste, trafic d\'armes, absence forces de sécurité', since: '2025' },
    ],
    curfew: 'Pas de couvre-feu national officiel. Forte présence militaire dans l\'Alibori. Restrictions de circulation nocturne recommandées dans les départements du nord.',
    checkpoints: ['Poste contrôle Aéroport Cotonou Cadjehoun', 'Barrage Entrée Nord Parakou', 'Checkpoint Route Kandi-Malanville'],
  },
  TG: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Lomé', phone: '+228 22 23 46 80', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Lomé', phone: '117 / +228 22 21 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'ANPC — Agence Nationale de Protection Civile', phone: '118 / +228 22 21 00 02', hours: '24/7' },
    ],
    hospitals: [
      { name: 'CHU Sylvanus Olympio', city: 'Lomé', type: 'CHU', phone: '+228 22 21 00 03', evacuation: true },
      { name: 'Clinique Autel d\'Élie', city: 'Lomé', type: 'Clinique privée', phone: '+228 22 21 00 04', evacuation: false },
      { name: 'Hôpital de Zone de Dapaong', city: 'Dapaong', type: 'Hôpital régional — tension capacitaire', phone: '+228 27 70 00 01', evacuation: true },
      { name: 'Hôpital Saint-Joseph de Dapaong', city: 'Dapaong', type: 'Hôpital confessionnel', phone: '+228 27 70 00 02', evacuation: false },
    ],
    noGoZones: [
      { name: 'Région des Savanes (Kpendjal, Oti, Tône)', reason: 'Massacres jihadistes, couvre-feu 20h-05h, état d\'urgence, 10 000 déplacés — JNIM actif', since: '2025' },
      { name: 'Frontière Burkina Faso (axe Dapaong-Cinkassé)', reason: 'Infiltration jihadiste, EEI, embuscades, absence de contrôle étatique', since: '2025' },
      { name: 'Parc national de la Kéran', reason: 'Zone suspecte d\'implantation jihadiste, surveillance limitée, déconseillé', since: '2026' },
    ],
    curfew: 'Couvre-feu 20:00-05:00 dans les préfectures de Kpendjal, Oti et Tône (région des Savanes). État d\'urgence prolongé de 6 mois.',
    checkpoints: ['Poste contrôle Aéroport Lomé Gnassingbé Eyadema', 'Barrage Route Lomé-Cotonou', 'Checkpoint Entrée Nord Dapaong'],
  },
  CI: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Abidjan', phone: '+225 27 20 20 60 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Plateau', phone: '110 / +225 27 20 21 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'ONPC — Office National de Protection Civile', phone: '111 / +225 27 20 21 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS West Africa Abidjan', phone: '+225 27 22 52 00 00', hours: '24/7' },
    ],
    hospitals: [
      { name: 'CHU de Treichville', city: 'Abidjan', type: 'CHU', phone: '+225 27 21 25 00 01', evacuation: true },
      { name: 'Polyclinique Internationale Sainte-Anne-Marie', city: 'Abidjan', type: 'Clinique privée', phone: '+225 27 21 25 00 02', evacuation: true },
      { name: 'CHU de Bouaké', city: 'Bouaké', type: 'CHU régional', phone: '+225 27 31 60 00 01', evacuation: false },
      { name: 'Hôpital Général de Korhogo', city: 'Korhogo', type: 'Hôpital régional', phone: '+225 27 36 80 00 01', evacuation: false },
    ],
    noGoZones: [
      { name: 'Parc national de la Comoé (zone frontalière)', reason: 'Incursions jihadistes depuis le Burkina — attaque gendarmerie août 2026, 1 200 soldats déployés', since: '2025' },
      { name: 'Frontière Burkina Faso (axe Bouna-Doropo)', reason: 'Zone de transit jihadiste, trafic d\'armes, mines artisanales, absence de contrôle', since: '2024' },
      { name: 'District du Zanzan (zones rurales)', reason: 'Risque d\'infiltration terroriste, postes de contrôle insuffisants, populations exposées', since: '2026' },
    ],
    curfew: 'Pas de couvre-feu national. 1 200 soldats déployés en renfort à la frontière nord. Vigilance maximale recommandée dans les régions septentrionales.',
    checkpoints: ['Poste contrôle Aéroport Abidjan Félix Houphouët-Boigny', 'Barrage Pont De Gaulle', 'Checkpoint Entrée Nord Bouaké', 'Poste frontière Bouna'],
  },
  KE: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Nairobi', phone: '+254 20 277 80 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'NPS — Headquarters Nairobi', phone: '999 / +254 20 355 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'NDOC — National Disaster Operations Centre', phone: '+254 20 355 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'AMREF Flying Doctors', phone: '+254 20 699 3000', hours: '24/7 — leader évacuation sanitaire Afrique de l\'Est' },
    ],
    hospitals: [
      { name: 'Aga Khan University Hospital', city: 'Nairobi', type: 'Hôpital universitaire privé', phone: '+254 20 366 2000', evacuation: true },
      { name: 'Nairobi Hospital', city: 'Nairobi', type: 'Hôpital privé', phone: '+254 20 284 5000', evacuation: true },
      { name: 'Kenyatta National Hospital', city: 'Nairobi', type: 'Hôpital national', phone: '+254 20 272 6300', evacuation: false },
      { name: 'Mombasa Hospital', city: 'Mombasa', type: 'Hôpital privé', phone: '+254 41 231 2191', evacuation: true },
    ],
    noGoZones: [
      { name: 'Comté de Garissa (zones frontalières)', reason: 'Embuscades Al-Shabaab, EEI sur convois, enlèvements ciblés, zone rouge formelle', since: '2011' },
      { name: 'Comté de Lamu (zone Boni Forest)', reason: 'Sanctuaire Al-Shabaab, opérations militaires en cours, villages incendiés', since: '2014' },
      { name: 'Comté de Mandera (frontière Somalie)', reason: 'Attaques transfrontalières, IED, assassinats de fonctionnaires, couvre-feu permanent', since: '2011' },
    ],
    curfew: 'Couvre-feu 18:00-06:00 dans les comtés de Garissa, Mandera, Wajir et Lamu. Restrictions nocturnes à Nairobi lors des manifestations.',
    checkpoints: ['Poste contrôle Aéroport Nairobi JKIA', 'Barrage Entrée Nairobi-Namanga', 'Checkpoint Thika Road', 'Poste sécurité Westlands'],
  },
  UG: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Kampala', phone: '+256 41 423 44 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'UPF — Uganda Police Force HQ', phone: '999 / +256 41 425 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'OPM — Office of the Prime Minister Disaster', phone: '+256 41 425 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'AMREF Flying Doctors Kampala', phone: '+256 31 226 4000', hours: '24/7 — évacuation vers Nairobi' },
    ],
    hospitals: [
      { name: 'Mulago National Referral Hospital', city: 'Kampala', type: 'Hôpital national', phone: '+256 41 454 00 01', evacuation: true },
      { name: 'International Hospital Kampala', city: 'Kampala', type: 'Hôpital privé', phone: '+256 41 434 00 01', evacuation: true },
      { name: 'Nakasero Hospital', city: 'Kampala', type: 'Hôpital privé', phone: '+256 41 453 00 01', evacuation: false },
      { name: 'Fort Portal Regional Referral Hospital', city: 'Fort Portal', type: 'Hôpital régional', phone: '+256 48 342 00 01', evacuation: false },
    ],
    noGoZones: [
      { name: 'District de Kasese (zones frontalières RDC)', reason: 'Attaques ADF, massacre école août 2026, enlèvements, zone militaire active — opération Shujaa', since: '2021' },
      { name: 'Parc national Queen Elizabeth (secteurs frontaliers)', reason: 'Incursions ADF, embuscades contre touristes et rangers, zone à risque', since: '2023' },
      { name: 'District de Bundibugyo (monts Rwenzori)', reason: 'Sanctuaire ADF, accès difficile, absence de contrôle sécuritaire continu', since: '2022' },
    ],
    curfew: 'Jour de deuil national suite au massacre de Kasese. Pas de couvre-feu permanent mais restrictions nocturnes recommandées dans l\'ouest du pays.',
    checkpoints: ['Poste contrôle Aéroport Entebbe', 'Barrage Route Kampala-Entebbe', 'Checkpoint Route Kampala-Kasese'],
  },
  GW: {
    contacts: [
      { type: 'Ambassade France', name: 'Bureau de liaison Bissau (via Dakar)', phone: '+221 33 839 51 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Judiciaire', name: 'Polícia Judiciária Bissau', phone: '+245 95 520 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'Serviço Nacional de Proteção Civil', phone: '+245 95 520 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS West Africa Coordination', phone: '+221 33 839 52 00', hours: '24/7 — évacuation vers Dakar' },
    ],
    hospitals: [
      { name: 'Hospital Nacional Simão Mendes', city: 'Bissau', type: 'Hôpital national — capacité limitée', phone: '+245 95 520 00 03', evacuation: true },
      { name: 'Clínica Madrugada', city: 'Bissau', type: 'Clinique privée', phone: '+245 95 520 00 04', evacuation: false },
      { name: 'Hospital Regional de Bafatá', city: 'Bafatá', type: 'Hôpital régional', phone: '—', evacuation: false },
      { name: 'Hospital Militar Principal', city: 'Bissau', type: 'Hôpital militaire', phone: '+245 95 520 00 05', evacuation: true },
    ],
    noGoZones: [
      { name: 'Bissau (après 20h)', reason: 'Couvre-feu post-tentative de coup d\'État, criminalité armée, trafic de drogue, instabilité politique', since: '2026' },
      { name: 'Archipel des Bijagós (zones non surveillées)', reason: 'Plaque tournante du narcotrafic, absence étatique, débarquements nocturnes de cocaïne', since: '2015' },
      { name: 'Frontière Guinée-Conakry', reason: 'Trafic d\'armes, banditisme transfrontalier, absence de contrôle douanier effectif', since: '2018' },
    ],
    curfew: 'Couvre-feu 20:00-06:00 à Bissau suite à la tentative de coup d\'État d\'août 2026. Situation volatile — tout déplacement nocturne est interdit.',
    checkpoints: ['Poste contrôle Aéroport Bissau Osvaldo Vieira', 'Barrage Entrée Bissau Centre', 'Checkpoint Port de Bissau'],
  },
  CG: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Brazzaville', phone: '+242 06 650 80 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Brazzaville', phone: '117 / +242 06 650 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'Corps des Sapeurs-Pompiers', phone: '118 / +242 06 650 00 02', hours: '24/7' },
    ],
    hospitals: [
      { name: 'CHU de Brazzaville', city: 'Brazzaville', type: 'CHU', phone: '+242 06 650 00 03', evacuation: true },
      { name: 'Clinique NetCare', city: 'Brazzaville', type: 'Clinique privée', phone: '+242 06 650 00 04', evacuation: false },
      { name: 'Hôpital Général de Pointe-Noire', city: 'Pointe-Noire', type: 'Hôpital général', phone: '+242 06 650 00 05', evacuation: true },
      { name: 'Hôpital de Base de Dolisie', city: 'Dolisie', type: 'Hôpital régional', phone: '—', evacuation: false },
    ],
    noGoZones: [
      { name: 'Département du Pool (axe RN1 Mayama)', reason: 'Blocage par ex-combattants ninjas, risque de reprise du conflit, accords de paix 2017 non appliqués', since: '2025' },
      { name: 'Département de la Likouala (zones frontalières)', reason: 'Épidémie de choléra, accès humanitaire limité, absence d\'infrastructures, tensions intercommunautaires', since: '2026' },
      { name: 'Département du Niari (zones forestières)', reason: 'Trafic d\'ivoire, groupes armés résiduels, présence incontrôlée dans les concessions forestières', since: '2020' },
    ],
    curfew: 'Pas de couvre-feu national. Restrictions de circulation recommandées sur la RN1 entre Brazzaville et Pointe-Noire. Vigilance dans le Pool.',
    checkpoints: ['Poste contrôle Aéroport Brazzaville Maya-Maya', 'Barrage PK45 RN1', 'Checkpoint Entrée Pointe-Noire'],
  },
  GA: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Libreville', phone: '+241 01 74 15 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Libreville', phone: '177 / +241 01 74 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'Protection Civile Gabonaise', phone: '18 / +241 01 74 00 02', hours: '24/7' },
    ],
    hospitals: [
      { name: 'CHU de Libreville', city: 'Libreville', type: 'CHU', phone: '+241 01 74 00 03', evacuation: true },
      { name: 'Polyclinique El Rapha', city: 'Libreville', type: 'Clinique privée', phone: '+241 01 74 00 04', evacuation: false },
      { name: 'Hôpital Régional de Port-Gentil', city: 'Port-Gentil', type: 'Hôpital régional', phone: '+241 01 55 00 01', evacuation: true },
      { name: 'Hôpital de l\'Amitié Sino-Gabonaise', city: 'Libreville', type: 'Hôpital général', phone: '+241 01 74 00 05', evacuation: false },
    ],
    noGoZones: [
      { name: 'Libreville (zones de manifestations)', reason: 'Répression violente des manifestations, arrestations massives, tensions pré-électorales — transition militaire', since: '2024' },
      { name: 'Province du Woleu-Ntem (frontière Cameroun-Guinée Éq.)', reason: 'Trafic transfrontalier, braconnage armé, contrebande, présence groupes armés', since: '2022' },
      { name: 'Parc national de la Lopé (périphérie)', reason: 'Braconnage organisé, trafic d\'ivoire, bandes armées, postes de contrôle insuffisants', since: '2021' },
    ],
    curfew: 'Pas de couvre-feu officiel mais restrictions ponctuelles lors des manifestations. Éviter les rassemblements et les déplacements nocturnes dans Libreville.',
    checkpoints: ['Poste contrôle Aéroport Libreville Léon Mba', 'Barrage Entrée Libreville Nord', 'Checkpoint Route du Cap Estérias'],
  },
  MR: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Nouakchott', phone: '+222 45 29 66 66', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Commissariat Central Nouakchott', phone: '117 / +222 45 29 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'Protection Civile Mauritanienne', phone: '118 / +222 45 29 00 02', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS West Africa Coordination', phone: '+221 33 839 52 00', hours: '24/7 — évacuation vers Dakar/Nouakchott' },
    ],
    hospitals: [
      { name: 'Centre Hospitalier National', city: 'Nouakchott', type: 'CHN', phone: '+222 45 29 00 03', evacuation: true },
      { name: 'Clinique Chiva', city: 'Nouakchott', type: 'Clinique privée', phone: '+222 45 29 00 04', evacuation: false },
      { name: 'Hôpital Militaire de Nouakchott', city: 'Nouakchott', type: 'Hôpital militaire', phone: '+222 45 29 00 05', evacuation: true },
      { name: 'Hôpital Régional de Kiffa', city: 'Kiffa', type: 'Hôpital régional', phone: '—', evacuation: false },
    ],
    noGoZones: [
      { name: 'Frontière algérienne (Tiris Zemmour)', reason: 'Zone de transit AQMI, trafics transsahariens, mines non cartographiées, absence étatique', since: '2012' },
      { name: 'Frontière malienne (Hodh Ech Chargui)', reason: 'Infiltration jihadiste depuis le Mali, camp de réfugiés de Mbera (45 000 personnes), risque enlèvement', since: '2012' },
      { name: 'Zone saharienne à l\'est de l\'axe Nouakchott-Atar', reason: 'Prolifération trafics, banditisme armé, absence de couverture sécuritaire continue', since: '2018' },
    ],
    curfew: 'Pas de couvre-feu national. Vigilance maximale à Nouakchott suite au démantèlement d\'une cellule jihadiste. Éviter les déplacements hors des axes principaux.',
    checkpoints: ['Poste contrôle Aéroport Nouakchott Oumtounsy', 'Barrage Entrée Nouakchott Sud', 'Checkpoint Route de Rosso'],
  },
  SC: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Victoria', phone: '+248 4 38 25 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Seychelles Police Force HQ — Victoria', phone: '999 / +248 4 28 80 00', hours: '24/7' },
      { type: 'Garde-Côtes', name: 'Seychelles Coast Guard — Base de Victoria', phone: '+248 4 28 82 00', hours: '24/7 — alerte piraterie' },
      { type: 'Protection Civile', name: 'DRDM — Division of Risk and Disaster Management', phone: '+248 4 28 89 00', hours: '24/7' },
      { type: 'MEDEVAC', name: 'ISOS Indian Ocean Coordination', phone: '+230 5 25 00 000', hours: '24/7 — évacuation vers Maurice ou La Réunion' },
    ],
    hospitals: [
      { name: 'Seychelles Hospital', city: 'Victoria (Mahé)', type: 'Hôpital national', phone: '+248 4 38 80 00', evacuation: true },
      { name: 'Victoria Hospital (Clinique privée)', city: 'Victoria (Mahé)', type: 'Clinique privée', phone: '+248 4 32 33 33', evacuation: true },
      { name: 'Baie Sainte Anne Hospital', city: 'Praslin', type: 'Hôpital de district — capacité limitée', phone: '+248 4 23 21 00', evacuation: false },
      { name: 'Logan Hospital', city: 'La Digue', type: 'Centre médical — évacuation obligatoire pour cas graves', phone: '+248 4 23 43 00', evacuation: false },
    ],
    noGoZones: [
      { name: 'ZEE seychelloise — zone de piraterie (nord et est de Mahé)', reason: 'Piraterie somalienne active, arraisonnements de yachts et bateaux de pêche, zone à risque élevé', since: '2009' },
      { name: 'Îles extérieures non habitées (Aldabra, Farquhar, Cosmoledo)', reason: 'Absence de forces de sécurité, points de débarquement de narcotrafiquants et migrants clandestins', since: '2018' },
      { name: 'Prison de Montagne Posée et environs', reason: 'Évasion récente de 5 détenus terroristes somaliens, zone de recherche active, risque de prise d\'otage', since: '2026' },
    ],
    curfew: 'Pas de couvre-feu national. Restrictions de navigation nocturne pour les bateaux de plaisance dans la ZEE. Vigilance rouge autour de la prison de Montagne Posée.',
    checkpoints: ['Poste contrôle Aéroport International de Mahé', 'Barrage Port de Victoria', 'Checkpoint Route Montagne Posée', 'Poste garde-côtes Base Navale Victoria'],
  },
  MU: {
    contacts: [
      { type: 'Ambassade France', name: 'Consulat Général Port-Louis', phone: '+230 2 02 01 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Mauritius Police Force HQ — Port-Louis', phone: '999 / +230 2 08 00 00', hours: '24/7' },
      { type: 'Garde-Côtes', name: 'National Coast Guard — Port-Louis', phone: '+230 2 08 12 34', hours: '24/7' },
      { type: 'Protection Civile', name: 'NDRRMC — National Disaster Risk Reduction Centre', phone: '+230 2 08 20 00', hours: '24/7 — coordination cyclonique' },
      { type: 'MEDEVAC', name: 'ISOS Indian Ocean Coordination', phone: '+230 5 25 00 000', hours: '24/7 — évacuation vers La Réunion' },
    ],
    hospitals: [
      { name: 'Victoria Hospital (ex-Candos)', city: 'Quatre Bornes', type: 'Hôpital régional', phone: '+230 4 25 30 00', evacuation: true },
      { name: 'Clinique Darné', city: 'Floréal', type: 'Clinique privée — la plus équipée de l\'île', phone: '+230 6 01 98 00', evacuation: true },
      { name: 'Sir Seewoosagur Ramgoolam National Hospital', city: 'Pamplemousses', type: 'Hôpital national', phone: '+230 2 43 30 00', evacuation: false },
      { name: 'Jawaharlal Nehru Hospital', city: 'Rose-Belle', type: 'Hôpital régional Sud', phone: '+230 6 27 30 00', evacuation: false },
    ],
    noGoZones: [
      { name: 'Zones côtières Est (Flic en Flac à Tamarin)', reason: 'Marée noire active — 8 000 tonnes de fioul, contamination toxique, évacuation en cours', since: '2026' },
      { name: 'Diego Garcia et archipel des Chagos (ZEE contestée)', reason: 'Base militaire UK/US, zone interdite à la navigation mauricienne, tensions diplomatiques actives', since: '1968' },
      { name: 'Île de Tromelin et ses eaux territoriales', reason: 'Souveraineté contestée France-Maurice, arraisonnements de pêcheurs mauriciens par la marine française', since: '2020' },
    ],
    curfew: 'Pas de couvre-feu national. Évacuation des zones côtières Est (Flic en Flac, Tamarin, Albion) ordonnée suite à la marée noire. Restrictions de pêche et baignade sur 15 km de côtes.',
    checkpoints: ['Poste contrôle Aéroport SSR Plaisance', 'Barrage Entrée Port-Louis (Caudan)', 'Checkpoint Route Flic en Flac — zone sinistrée', 'Poste garde-côtes Port-Louis'],
  },
  KM: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Moroni', phone: '+269 7 73 02 50', hours: 'Lun-Jeu 08:00-15:00, Ven 08:00-12:00' },
      { type: 'Gendarmerie Nationale', name: 'État-Major Gendarmerie — Moroni', phone: '17 / +269 7 73 00 01', hours: '24/7' },
      { type: 'Protection Civile', name: 'Direction Générale de la Sécurité Civile', phone: '18 / +269 7 73 00 02', hours: '24/7 — coordination volcan Karthala' },
      { type: 'MEDEVAC', name: 'ISOS Indian Ocean Coordination', phone: '+230 5 25 00 000', hours: '24/7 — évacuation vers Maurice, La Réunion ou Nairobi' },
    ],
    hospitals: [
      { name: 'Centre Hospitalier National El-Maarouf', city: 'Moroni', type: 'Hôpital national', phone: '+269 7 73 00 03', evacuation: true },
      { name: 'Hôpital de Hombo (MSF)', city: 'Mutsamudu (Anjouan)', type: 'Hôpital MSF — choléra', phone: '+269 7 73 00 04', evacuation: true },
      { name: 'Hôpital Régional de Fomboni', city: 'Fomboni (Mohéli)', type: 'Hôpital régional — capacité très limitée', phone: '—', evacuation: false },
      { name: 'Centre Médical de Mitsamiouli', city: 'Mitsamiouli (Grande Comore)', type: 'Centre de santé — premier recours évacuation', phone: '—', evacuation: false },
    ],
    noGoZones: [
      { name: 'Zone d\'exclusion du Karthala (rayon 8 km autour du cratère)', reason: 'Éruption imminente — nuées ardentes, coulées de lave, gaz toxiques, 300 000 personnes menacées', since: '2026' },
      { name: 'Canal du Mozambique (traversées vers Mayotte)', reason: 'Naufrages mortels récurrents, 89 morts en 2026, réseau de passeurs, pas de surveillance SAR', since: '2020' },
      { name: 'Quartiers périphériques de Moroni la nuit', reason: 'Criminalité, tensions politiques post-arrestations, absence d\'éclairage public, risques d\'agression', since: '2024' },
    ],
    curfew: 'Couvre-feu de facto dans la zone d\'exclusion du Karthala. Évacuation obligatoire des villages dans un rayon de 8 km. Restrictions nocturnes à Moroni suite aux troubles politiques.',
    checkpoints: ['Poste contrôle Aéroport Moroni Hahaya', 'Barrage Entrée Moroni Nord', 'Checkpoint Route Moroni-Mitsamiouli (zone Karthala)', 'Poste Port de Moroni'],
  },
  CV: {
    contacts: [
      { type: 'Ambassade France', name: 'Section consulaire Praia', phone: '+238 2 61 20 00', hours: 'Lun-Ven 08:00-16:00' },
      { type: 'Police Nationale', name: 'Polícia Nacional — Comando Praia', phone: '132 / +238 2 61 10 00', hours: '24/7' },
      { type: 'Protection Civile', name: 'SNPC — Serviço Nacional de Proteção Civil', phone: '130 / +238 2 61 90 00', hours: '24/7 — coordination volcan Fogo' },
      { type: 'MEDEVAC', name: 'ISOS West Africa / Atlantique Coordination', phone: '+221 33 839 52 00', hours: '24/7 — évacuation vers Dakar ou Lisbonne' },
    ],
    hospitals: [
      { name: 'Hospital Dr. Agostinho Neto', city: 'Praia (Santiago)', type: 'Hôpital central', phone: '+238 2 61 00 01', evacuation: true },
      { name: 'Hospital Baptista de Sousa', city: 'Mindelo (São Vicente)', type: 'Hôpital régional', phone: '+238 2 32 00 01', evacuation: true },
      { name: 'Hospital Regional de São Filipe', city: 'São Filipe (Fogo)', type: 'Hôpital régional — capacité réduite en cas d\'éruption', phone: '+238 2 81 00 01', evacuation: true },
      { name: 'Hospital Regional de Sal', city: 'Espargos (Sal)', type: 'Hôpital régional', phone: '+238 2 41 00 01', evacuation: false },
    ],
    noGoZones: [
      { name: 'Île de Fogo — zone volcanique active (Chã das Caldeiras)', reason: 'Éruption imminente, 2 000 personnes évacuées, risque de nuées ardentes et coulées de lave', since: '2024' },
      { name: 'Port de Mindelo — zone portuaire industrielle', reason: 'Hub de narcotrafic transatlantique, présence de cartels sud-américains (PCC), saisies régulières de cocaïne', since: '2023' },
      { name: 'Quartiers périphériques de Praia (Achada Santo António, Tira Chapéu)', reason: 'Guerre des gangs liée au narcotrafic, homicides, présence d\'armes à feu, exécutions ciblées', since: '2025' },
    ],
    curfew: 'Pas de couvre-feu national. Évacuation des zones à risque de l\'île de Fogo. Vigilance maximale à Praia suite à la montée de la violence liée aux cartels.',
    checkpoints: ['Poste contrôle Aéroport Nelson Mandela Praia', 'Barrage Entrée Port de Praia', 'Checkpoint Route Praia-Assomada', 'Poste contrôle Aéroport Cesária Évora Mindelo'],
  },
};

const DEFAULT_OPERATIONAL: {
  contacts: OperationalContact[];
  hospitals: HospitalRef[];
  noGoZones: NoGoZone[];
  curfew: string | null;
  checkpoints: string[];
} = {
  contacts: [
    { type: 'Ambassade/Consulat', name: 'Consultez la fiche pays complète', phone: '—', hours: 'Horaires variables' },
    { type: 'Police Nationale', name: 'Numéro d\'urgence local', phone: '—', hours: '24/7' },
  ],
  hospitals: [
    { name: 'Hôpital de référence du pays', city: 'Capitale', type: 'Hôpital général', phone: '—', evacuation: true },
  ],
  noGoZones: [
    { name: 'Zones à consulter', reason: 'Consultez la fiche pays complète', since: '—' },
  ],
  curfew: 'Aucun couvre-feu signalé. Consultez la fiche pays pour les restrictions locales.',
  checkpoints: ['Consultez la fiche pays complète'],
};

export default function CountryOperationalPanel({ countryName, countryCode, level }: CountryOperationalPanelProps) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'hospitals' | 'zones' | 'checkpoints'>('contacts');
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  const data = useMemo(() => {
    return OPERATIONAL_DATA[countryCode] || DEFAULT_OPERATIONAL;
  }, [countryCode]);

  const isHighRisk = level === 'rouge' || level === 'orange';

  const tabs = [
    { key: 'contacts' as const, label: t('dashboard.operational.tabContacts'), icon: 'ri-phone-line' },
    { key: 'hospitals' as const, label: t('dashboard.operational.tabHospitals'), icon: 'ri-hospital-line' },
    { key: 'zones' as const, label: t('dashboard.operational.tabNoGo'), icon: 'ri-forbid-line' },
    { key: 'checkpoints' as const, label: t('dashboard.operational.tabCheckpoints'), icon: 'ri-road-map-line' },
  ];

  return (
    <div className="bg-white dark:bg-[#111827] rounded-lg border border-gray-100 dark:border-[#1e293b]">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-shield-check-line text-emerald-600 text-base" />
          <h2 className="text-sm font-bold text-sentiqs-navy dark:text-white">
            {isFr ? `Fiche opérationnelle — ${countryName}` : `Operational Sheet — ${countryName}`}
          </h2>
          {isHighRisk && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-bold">
              {isFr ? 'HAUTE PRIORITÉ' : 'HIGH PRIORITY'}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1a2232] rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-sentiqs-navy text-sentiqs-navy dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <i className={`${tab.icon} text-xs`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Contacts */}
        {activeTab === 'contacts' && (
          <div className="space-y-2">
            {data.contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-[#1a2232] hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors">
                <div className="w-8 h-8 rounded-full bg-sentiqs-navy/10 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                  <i className="ri-phone-line text-sentiqs-navy dark:text-gray-300 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">{c.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{c.type} · {c.hours}</div>
                </div>
                <span className="text-xs font-bold font-mono text-sentiqs-navy dark:text-gray-200 whitespace-nowrap">{c.phone}</span>
              </div>
            ))}
            {data.curfew && (
              <div className={`mt-3 p-2.5 rounded-lg border ${isHighRisk ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <i className={`${isHighRisk ? 'ri-alert-line text-red-600' : 'ri-moon-line text-yellow-600'} text-xs`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{t('dashboard.operational.curfew')}</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300">{data.curfew}</p>
              </div>
            )}
          </div>
        )}

        {/* Hospitals */}
        {activeTab === 'hospitals' && (
          <div className="space-y-2">
            {data.hospitals.map((h, i) => (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                h.evacuation
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-50 dark:bg-[#1a2232] border-gray-100 dark:border-[#1e293b]'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  h.evacuation ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  <i className="ri-hospital-line text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{h.name}</span>
                    {h.evacuation && (
                      <span className="px-1 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-bold">MEDEVAC</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{h.city} · {h.type}</div>
                </div>
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{h.phone}</span>
              </div>
            ))}
          </div>
        )}

        {/* No-Go Zones */}
        {activeTab === 'zones' && (
          <div className="space-y-2">
            {data.noGoZones.map((z, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                <div className="w-7 h-7 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-close-line text-red-700 dark:text-red-400 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-800 dark:text-red-400">{z.name}</span>
                    <span className="text-[9px] text-red-500 dark:text-red-500">{isFr ? 'Depuis' : 'Since'} {z.since}</span>
                  </div>
                  <p className="text-[10px] text-red-700 dark:text-red-300 mt-0.5">{z.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Checkpoints */}
        {activeTab === 'checkpoints' && (
          <div className="space-y-2">
            {data.checkpoints.map((cp, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-[#1a2232]">
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <i className="ri-map-pin-2-line text-amber-600 dark:text-amber-400 text-sm" />
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{cp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}