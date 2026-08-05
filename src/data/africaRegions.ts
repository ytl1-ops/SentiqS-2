// ============================================================
// SentiqS — 54 pays africains classés par Région Ops Room
// ============================================================

export interface AfricaCountry {
  code: string;
  name: string;
  capital: string;
  region: string;
  subRegions: string[];
  independenceDay?: string;
}

export const AFRICA_REGIONS: Record<string, AfricaCountry[]> = {
  "Afrique du Nord / Maghreb": [
    { code: "DZ", name: "Algérie", capital: "Alger", region: "Afrique du Nord / Maghreb", subRegions: ["Alger", "Oran", "Tamanrasset", "In Amenas", "Ghardaïa"], independenceDay: "5 juillet" },
    { code: "EG", name: "Égypte", capital: "Le Caire", region: "Afrique du Nord / Maghreb", subRegions: ["Le Caire", "Alexandrie", "Sinaï", "Haute-Égypte", "Delta du Nil"], independenceDay: "23 juillet" },
    { code: "LY", name: "Libye", capital: "Tripoli", region: "Afrique du Nord / Maghreb", subRegions: ["Tripoli", "Benghazi", "Sebha", "Misrata", "Fezzan"], independenceDay: "24 décembre" },
    { code: "MA", name: "Maroc", capital: "Rabat", region: "Afrique du Nord / Maghreb", subRegions: ["Rabat-Salé", "Casablanca", "Laâyoune", "Dakhla", "Marrakech"], independenceDay: "18 novembre" },
    { code: "TN", name: "Tunisie", capital: "Tunis", region: "Afrique du Nord / Maghreb", subRegions: ["Tunis", "Sfax", "Ben Gardane", "Kasserine", "Sousse"], independenceDay: "20 mars" },
  ],
  "Sahel": [
    { code: "BF", name: "Burkina Faso", capital: "Ouagadougou", region: "Sahel", subRegions: ["Ouagadougou", "Djibo", "Dori", "Bobo-Dioulasso", "Fada N'Gourma"], independenceDay: "5 août" },
    { code: "ML", name: "Mali", capital: "Bamako", region: "Sahel", subRegions: ["Bamako", "Ménaka", "Kidal", "Gao", "Tombouctou"], independenceDay: "22 septembre" },
    { code: "MR", name: "Mauritanie", capital: "Nouakchott", region: "Sahel", subRegions: ["Nouakchott", "Bassikounou", "Nouadhibou", "Atar", "Kiffa"], independenceDay: "28 novembre" },
    { code: "NE", name: "Niger", capital: "Niamey", region: "Sahel", subRegions: ["Niamey", "Agadez", "Diffa", "Tillabéri", "Zinder"], independenceDay: "3 août" },
    { code: "TD", name: "Tchad", capital: "N'Djamena", region: "Sahel", subRegions: ["N'Djamena", "Bol", "Abéché", "Moundou", "Faya-Largeau"], independenceDay: "11 août" },
  ],
  "Golfe de Guinée": [
    { code: "BJ", name: "Bénin", capital: "Cotonou", region: "Golfe de Guinée", subRegions: ["Cotonou", "Parakou", "Natitingou", "Porto-Novo", "Abomey"], independenceDay: "1er août" },
    { code: "CI", name: "Côte d'Ivoire", capital: "Abidjan", region: "Golfe de Guinée", subRegions: ["Abidjan", "Bouaké", "Yamoussoukro", "Man", "Duékoué"], independenceDay: "7 août" },
    { code: "GH", name: "Ghana", capital: "Accra", region: "Golfe de Guinée", subRegions: ["Accra", "Kumasi", "Tamale", "Tema", "Takoradi"], independenceDay: "6 mars" },
    { code: "NG", name: "Nigeria", capital: "Abuja", region: "Golfe de Guinée", subRegions: ["Abuja", "Lagos", "Maiduguri", "Port Harcourt", "Kano"], independenceDay: "1er octobre" },
    { code: "TG", name: "Togo", capital: "Lomé", region: "Golfe de Guinée", subRegions: ["Lomé", "Sokodé", "Kara", "Aného", "Dapaong"], independenceDay: "27 avril" },
  ],
  "Afrique de l'Ouest": [
    { code: "CV", name: "Cap-Vert", capital: "Praia", region: "Afrique de l'Ouest", subRegions: ["Praia", "Mindelo", "Assomada", "Sal", "São Filipe"], independenceDay: "5 juillet" },
    { code: "GM", name: "Gambie", capital: "Banjul", region: "Afrique de l'Ouest", subRegions: ["Banjul", "Barra", "Serekunda", "Brikama", "Basse Santa Su"], independenceDay: "18 février" },
    { code: "GN", name: "Guinée", capital: "Conakry", region: "Afrique de l'Ouest", subRegions: ["Conakry", "Guéckédou", "Siguiri", "Nzérékoré", "Kindia"], independenceDay: "2 octobre" },
    { code: "GW", name: "Guinée-Bissau", capital: "Bissau", region: "Afrique de l'Ouest", subRegions: ["Bissau", "Bafatá", "Gabú", "Cacheu", "Bolama"], independenceDay: "24 septembre" },
    { code: "LR", name: "Liberia", capital: "Monrovia", region: "Afrique de l'Ouest", subRegions: ["Monrovia", "Ganta", "Buchanan", "Gbarnga", "Harper"], independenceDay: "26 juillet" },
    { code: "SL", name: "Sierra Leone", capital: "Freetown", region: "Afrique de l'Ouest", subRegions: ["Freetown", "Kenema", "Koidu", "Bo", "Makeni"], independenceDay: "27 avril" },
    { code: "SN", name: "Sénégal", capital: "Dakar", region: "Afrique de l'Ouest", subRegions: ["Dakar", "Bignona", "Rufisque", "Saint-Louis", "Ziguinchor"], independenceDay: "4 avril" },
  ],
  "Afrique Centrale": [
    { code: "CF", name: "Centrafrique", capital: "Bangui", region: "Afrique Centrale", subRegions: ["Bangui", "Bria", "Bambari", "Berbérati", "Bossangoa"], independenceDay: "1er décembre" },
    { code: "CG", name: "Congo", capital: "Brazzaville", region: "Afrique Centrale", subRegions: ["Brazzaville", "Impfondo", "Dolisie", "Pointe-Noire", "Owando"], independenceDay: "15 août" },
    { code: "GA", name: "Gabon", capital: "Libreville", region: "Afrique Centrale", subRegions: ["Libreville", "Makokou", "Port-Gentil", "Franceville", "Oyem"], independenceDay: "17 août" },
    { code: "GQ", name: "Guinée Équatoriale", capital: "Malabo", region: "Afrique Centrale", subRegions: ["Malabo", "Bata", "Ebibeyin", "Mongomo", "Luba"], independenceDay: "12 octobre" },
    { code: "ST", name: "Sao Tomé-et-Principe", capital: "São Tomé", region: "Afrique Centrale", subRegions: ["São Tomé", "Santo António", "Neves", "Santana", "Trindade"], independenceDay: "12 juillet" },
  ],
  "Grands Lacs": [
    { code: "BI", name: "Burundi", capital: "Gitega", region: "Grands Lacs", subRegions: ["Gitega", "Bujumbura", "Cibitoke", "Makamba", "Ngozi"], independenceDay: "1er juillet" },
    { code: "RW", name: "Rwanda", capital: "Kigali", region: "Grands Lacs", subRegions: ["Kigali", "Gisenyi", "Butare", "Ruhengeri", "Kibuye"], independenceDay: "1er juillet" },
    { code: "UG", name: "Ouganda", capital: "Kampala", region: "Grands Lacs", subRegions: ["Kampala", "Moroto", "Gulu", "Jinja", "Mbarara"], independenceDay: "9 octobre" },
  ],
  "Afrique de l'Est": [
    { code: "ET", name: "Éthiopie", capital: "Addis-Abeba", region: "Afrique de l'Est", subRegions: ["Addis-Abeba", "Shire", "Jijiga", "Dire Dawa", "Mekele"], independenceDay: "—" },
    { code: "KE", name: "Kenya", capital: "Nairobi", region: "Afrique de l'Est", subRegions: ["Nairobi", "Mandera", "Mombasa", "Lodwar", "Moyale"], independenceDay: "12 décembre" },
    { code: "MW", name: "Malawi", capital: "Lilongwe", region: "Afrique de l'Est", subRegions: ["Lilongwe", "Karonga", "Blantyre", "Mzuzu", "Zomba"], independenceDay: "6 juillet" },
    { code: "TZ", name: "Tanzanie", capital: "Dodoma", region: "Afrique de l'Est", subRegions: ["Dodoma", "Dar es Salaam", "Kasulu", "Arusha", "Zanzibar"], independenceDay: "26 avril" },
    { code: "KM", name: "Comores", capital: "Moroni", region: "Afrique de l'Est", subRegions: ["Moroni", "Mutsamudu", "Fomboni", "Domoni", "Ouani"], independenceDay: "6 juillet" },
  ],
  "Corne de l'Afrique": [
    { code: "DJ", name: "Djibouti", capital: "Djibouti", region: "Corne de l'Afrique", subRegions: ["Djibouti", "Obock", "Tadjourah", "Dikhil", "Ali Sabieh"], independenceDay: "27 juin" },
    { code: "ER", name: "Érythrée", capital: "Asmara", region: "Corne de l'Afrique", subRegions: ["Asmara", "Massawa", "Keren", "Assab", "Mendefera"], independenceDay: "24 mai" },
    { code: "SO", name: "Somalie", capital: "Mogadiscio", region: "Corne de l'Afrique", subRegions: ["Mogadiscio", "Baidoa", "Bosaso", "Kismayo", "Hargeisa"], independenceDay: "1er juillet" },
    { code: "SD", name: "Soudan", capital: "Khartoum", region: "Corne de l'Afrique", subRegions: ["Khartoum", "El Fasher", "Port-Soudan", "Nyala", "Kassala"], independenceDay: "1er janvier" },
    { code: "SS", name: "Soudan du Sud", capital: "Juba", region: "Corne de l'Afrique", subRegions: ["Juba", "Bentiu", "Yei", "Malakal", "Wau"], independenceDay: "9 juillet" },
  ],
  "Afrique Australe": [
    { code: "AO", name: "Angola", capital: "Luanda", region: "Afrique Australe", subRegions: ["Luanda", "Buco-Zau", "Luau", "Huambo", "Lobito"], independenceDay: "11 novembre" },
    { code: "BW", name: "Botswana", capital: "Gaborone", region: "Afrique Australe", subRegions: ["Gaborone", "Maun", "Francistown", "Kasane", "Molepolole"], independenceDay: "30 septembre" },
    { code: "LS", name: "Lesotho", capital: "Maseru", region: "Afrique Australe", subRegions: ["Maseru", "Leribe", "Mafeteng", "Mohale's Hoek", "Qacha's Nek"], independenceDay: "4 octobre" },
    { code: "MZ", name: "Mozambique", capital: "Maputo", region: "Afrique Australe", subRegions: ["Maputo", "Mocímboa da Praia", "Pemba", "Beira", "Nampula"], independenceDay: "25 juin" },
    { code: "NA", name: "Namibie", capital: "Windhoek", region: "Afrique Australe", subRegions: ["Windhoek", "Katima Mulilo", "Swakopmund", "Walvis Bay", "Oshakati"], independenceDay: "21 mars" },
    { code: "SZ", name: "Eswatini", capital: "Mbabane", region: "Afrique Australe", subRegions: ["Mbabane", "Manzini", "Lobamba", "Siteki", "Nhlangano"], independenceDay: "6 septembre" },
    { code: "ZA", name: "Afrique du Sud", capital: "Pretoria", region: "Afrique Australe", subRegions: ["Pretoria", "Johannesburg", "Le Cap", "Durban", "Soweto"], independenceDay: "27 avril" },
    { code: "ZM", name: "Zambie", capital: "Lusaka", region: "Afrique Australe", subRegions: ["Lusaka", "Solwezi", "Kitwe", "Ndola", "Livingstone"], independenceDay: "24 octobre" },
    { code: "ZW", name: "Zimbabwe", capital: "Harare", region: "Afrique Australe", subRegions: ["Harare", "Hwange", "Zvishavane", "Bulawayo", "Mutare"], independenceDay: "18 avril" },
  ],
  "Océan Indien": [
    { code: "MG", name: "Madagascar", capital: "Antananarivo", region: "Océan Indien", subRegions: ["Antananarivo", "Mahajanga", "Toamasina", "Antsirabe", "Toliara"], independenceDay: "26 juin" },
    { code: "MU", name: "Maurice", capital: "Port-Louis", region: "Océan Indien", subRegions: ["Port-Louis", "Flic en Flac", "Tamarin", "Curepipe", "Grand Baie"], independenceDay: "12 mars" },
    { code: "SC", name: "Seychelles", capital: "Victoria", region: "Océan Indien", subRegions: ["Victoria", "Beau Vallon", "Anse Royale", "Praslin", "La Digue"], independenceDay: "29 juin" },
  ],
  "RDC": [
    { code: "CD", name: "RDC", capital: "Kinshasa", region: "RDC", subRegions: ["Kinshasa", "Beni", "Lubumbashi", "Goma", "Kisangani"], independenceDay: "30 juin" },
    { code: "CM", name: "Cameroun", capital: "Yaoundé", region: "RDC", subRegions: ["Yaoundé", "Douala", "Kolofata", "Bamenda", "Garoua"], independenceDay: "20 mai" },
  ],
};

export const ALL_AFRICA_COUNTRIES: AfricaCountry[] = Object.values(AFRICA_REGIONS).flat();

export const REGION_ORDER = Object.keys(AFRICA_REGIONS);