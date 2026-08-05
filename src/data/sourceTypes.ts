// ============================================================
// SentiqS — 15 Typologies de Sources de Référence
// ============================================================

export interface SourceType {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  icon: string;
  examples: string[];
}

export const SOURCE_TYPES: SourceType[] = [
  {
    id: "agences-nationales",
    name: "Agences de Presse Nationales",
    category: "Presse",
    description: "Actu locale et régionale via agences nationales africaines",
    color: "emerald",
    icon: "newspaper",
    examples: ["AIP (Côte d'Ivoire)", "APS (Sénégal)", "TAP (Tunisie)", "ABP (Bénin)", "AGP (Gabon)"],
  },
  {
    id: "ministere-infrastructures",
    name: "Ministère des Infrastructures / Transports",
    category: "Gouvernement",
    description: "Fermetures de routes, travaux et perturbations logistiques",
    color: "orange",
    icon: "construction",
    examples: ["Ministère des Transports CI", "Ministère Infrastructures SN", "ANASER Sénégal"],
  },
  {
    id: "ministere-interieur",
    name: "Ministère de l'Intérieur / Sécurité Publique",
    category: "Gouvernement",
    description: "Communiqués officiels, arrêtés et alertes sécurité intérieure",
    color: "red",
    icon: "shield",
    examples: ["Ministère Intérieur BF", "Ministère Sécurité CI", "DGSN Maroc", "Police Nationale SN"],
  },
  {
    id: "acled",
    name: "ACLED",
    category: "OSINT",
    description: "Incidents sécuritaires géolocalisés — Armed Conflict Location & Event Data",
    color: "amber",
    icon: "map-pin",
    examples: ["ACLED Data", "ACLED Africa Desk", "ACLED Sahel Monitor"],
  },
  {
    id: "reliefweb",
    name: "ReliefWeb (OCHA ONU)",
    category: "Humanitaire",
    description: "Crises humanitaires, urgences locales et rapports de situation",
    color: "sky",
    icon: "globe",
    examples: ["ReliefWeb Afrique", "OCHA Sahel", "OCHA Afrique Centrale"],
  },
  {
    id: "fondation-hirondelle",
    name: "Fondation Hirondelle",
    category: "Média",
    description: "Veille hyper-locale et zones rurales via radios partenaires",
    color: "violet",
    icon: "radio",
    examples: ["Studio Tamani (Mali)", "Kalangou (Niger)", "Yafa (RCA)", "Studio Sifaka (Madagascar)"],
  },
  {
    id: "radio-okapi",
    name: "Radio Okapi (MONUSCO)",
    category: "Média",
    description: "Suivi Afrique centrale et région des Grands Lacs",
    color: "indigo",
    icon: "antenna",
    examples: ["Radio Okapi RDC", "Radio Okapi Grands Lacs"],
  },
  {
    id: "koaci",
    name: "KOACI & Presse d'investigation",
    category: "Presse",
    description: "Faits divers, tensions communautaires et enquêtes locales",
    color: "slate",
    icon: "search",
    examples: ["KOACI.com", "Jeune Afrique", "Le Monde Afrique", "RFI Afrique"],
  },
  {
    id: "iss-africa",
    name: "ISS Africa",
    category: "Think Tank",
    description: "Analyses de sûreté, risques géopolitiques et rapports stratégiques",
    color: "teal",
    icon: "brain",
    examples: ["ISS Pretoria", "ISS Dakar", "ISS Addis-Abeba", "ISS Nairobi"],
  },
  {
    id: "who-africa",
    name: "WHO Africa / OMS",
    category: "Santé",
    description: "Alertes épidémiologiques, urgences sanitaires et veille santé",
    color: "rose",
    icon: "heart-pulse",
    examples: ["OMS Afro", "WHO Africa Weekly Bulletin", "OMS Urgences"],
  },
  {
    id: "journal-officiel",
    name: "Journal Officiel & Calendriers Gouvernementaux",
    category: "Gouvernement",
    description: "Fêtes nationales, jours d'indépendance et jours fériés",
    color: "lime",
    icon: "calendar",
    examples: ["JO Côte d'Ivoire", "JO Sénégal", "Gov.gh (Ghana)", "Primature ML"],
  },
  {
    id: "observatoires-fonciers",
    name: "Observatoires de Tensions Foncières",
    category: "Société Civile",
    description: "Conflits communautaires ruraux et tensions foncières",
    color: "yellow",
    icon: "land-plot",
    examples: ["ONF CI", "Land Matrix Africa", "Observatoire Foncier BF", "Cadastre Rural SN"],
  },
  {
    id: "agendas-academiques",
    name: "Agendas Académiques",
    category: "Académique",
    description: "Colloques, séminaires, sommets et conférences universitaires",
    color: "cyan",
    icon: "graduation-cap",
    examples: ["UCAD Dakar", "Université FHB Abidjan", "Université de Lomé", "CAMES"],
  },
  {
    id: "allafrica",
    name: "AllAfrica (Flux Filtrés)",
    category: "Agrégateur",
    description: "Presse régionale agrégée — curation multi-sources sur l'Afrique",
    color: "blue",
    icon: "rss",
    examples: ["AllAfrica.com", "AllAfrica Sahel Feed", "AllAfrica West Africa"],
  },
  {
    id: "africanews",
    name: "Africanews",
    category: "Média",
    description: "Fil d'actualité continu du continent africain",
    color: "green",
    icon: "satellite-dish",
    examples: ["Africanews.com", "Africanews TV", "Africanews Mobile"],
  },
];

export function getSourceTypeById(id: string): SourceType | undefined {
  return SOURCE_TYPES.find((s) => s.id === id);
}

export function getSourceTypeByName(name: string): SourceType | undefined {
  return SOURCE_TYPES.find((s) =>
    s.name.toLowerCase() === name.toLowerCase() ||
    s.examples.some((ex) => ex.toLowerCase().includes(name.toLowerCase()))
  );
}

export const SOURCE_COLORS: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300",
  red: "bg-red-100 text-red-800 border-red-300",
  amber: "bg-amber-100 text-amber-800 border-amber-300",
  sky: "bg-sky-100 text-sky-800 border-sky-300",
  violet: "bg-violet-100 text-violet-800 border-violet-300",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
  slate: "bg-slate-100 text-slate-800 border-slate-300",
  teal: "bg-teal-100 text-teal-800 border-teal-300",
  rose: "bg-rose-100 text-rose-800 border-rose-300",
  lime: "bg-lime-100 text-lime-800 border-lime-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  green: "bg-green-100 text-green-800 border-green-300",
};

export const SOURCE_DARK_COLORS: Record<string, string> = {
  emerald: "dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  orange: "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  red: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  amber: "dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  sky: "dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
  violet: "dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
  indigo: "dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
  slate: "dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700",
  teal: "dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  rose: "dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
  lime: "dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-700",
  yellow: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  cyan: "dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700",
  blue: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  green: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
};