// ============================================================
// SentiqS — Données du dashboard
// Toutes les données proviennent de Supabase (DB temps réel)
// Ce fichier ne contient plus de données fictives
// ============================================================

import { isMockData } from '@/utils/dataIntegrity';

/**
 * Guard de production — log une erreur console si des mocks sont utilisés
 * en production. Empêche le remplacement silencieux des vraies données.
 */
export function assertNoMockLeak(source: string, data: unknown[]): void {
  if (import.meta.env.PROD) {
    const mockItems = data.filter((item) =>
      isMockData(item as unknown as Record<string, unknown>)
    );
    if (mockItems.length > 0) {
      console.error(
        `[PROD-GUARD] ${source} : ${mockItems.length} élément(s) mock détecté(s) en production ! ` +
        'Ceci est une fuite de données fictives — les données réelles doivent provenir de Supabase.',
        mockItems
      );
    }
  }
}

/** Vérifie si l'environnement est la production (hors dev local) */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

// Types pour les pages qui n'ont pas encore migré vers Supabase
export interface AgendaEvent {
  id: string;
  date: string;
  title: string;
  titleEn?: string;
  type: 'meeting' | 'exercise' | 'conference' | 'audit' | 'briefing' | 'training' | 'deadline' | 'mission';
  priority: 'critical' | 'high' | 'medium' | 'low';
  time: string;
  duration: string;
  location: string;
  country: string;
  department?: string;
  organizer: string;
  participants: number;
  description: string;
}

export interface ReportItem {
  id: string;
  title: string;
  titleEn?: string;
  type: string;
  format: string;
  region: string;
  countries: string[];
  localities?: string[];
  alertCount: number;
  corrCount: number;
  generatedAt: string;
  status: 'ready' | 'generating';
  size?: string;
  author: string;
  summary: string;
  content?: {
    executiveSummary: string;
    sections: Array<{ title: string; text: string }>;
    stats: Array<{ label: string; value: string | number }>;
    alertsIncluded: Array<{ id: string; title: string; severity: string; locality: string; department: string }>;
    correlationsIncluded: Array<{ id: string; type: string; strength: string; confidence: number; description: string }>;
    charts: Array<{ label: string; values: number[]; max: number }>;
  };
}

// Données vides — alimentées par Supabase en production
export const agendaEvents: AgendaEvent[] = [];
export const reports: ReportItem[] = [];
export const scheduledReports: unknown[] = [];
export const dashboardAlerts: unknown[] = [];
export const dashboardFeeds: unknown[] = [];
export const countryRiskLevels: unknown[] = [];
export const correlations: unknown[] = [];
export const timelineEvents: unknown[] = [];
export const activityData: unknown[] = [];
export const alertsTotal = 0;
export const localIntelSummary = {
  totalLocalities: 0,
  totalDepartments: 0,
  localitiesMonitoredToday: 0,
  departmentsWithActiveAlerts: 0,
  topHotspots: [] as unknown[],
  localCoverage: {} as Record<string, { departments: number; localities: number; activeNow: number }>,
};
export const dashboardStats = {
  activeAlerts: 0,
  newFeeds24h: 0,
  countriesInAlert: 0,
  localitiesMonitored: 0,
  correlationsDetected: 0,
  totalMonitored: 54,
  responseTime: '--',
};