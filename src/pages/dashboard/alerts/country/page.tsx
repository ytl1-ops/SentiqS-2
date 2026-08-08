import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { africaCountryCenters } from '@/data/africaCoordinates';
import { useAlertLevels, LEVEL_COLORS, LEVEL_BG, COUNTRY_NAME_BY_CODE } from '@/hooks/useAlertLevels';
import type { TriggeringIncident } from '@/hooks/useAlertLevels';
import CountryMap from './components/CountryMap';
import TrendChart from './components/TrendChart';
import Timeline30d from './components/Timeline30d';
import CountryOperationalPanel from './components/CountryOperationalPanel';
import ScoreJustificationPanel from './components/ScoreJustificationPanel';
import ErrorState from '@/components/base/ErrorState';
import i18n from '@/i18n';

interface Alert30d {
  id: string;
  severity: string;
  title: string;
  country: string;
  locality: string;
  timestamp: string;
  source: string;
  category: string;
  status: string;
}

interface Feed30d {
  id: string;
  title: string;
  country: string;
  category: string;
  source: string;
  timestamp: string;
  verification_status: string;
  summary?: string;
}

export default function CountryAlertDetailPage() {
  const { countryCode } = useParams<{ countryCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { alertLevels } = useAlertLevels();

  const [alerts30d, setAlerts30d] = useState<Alert30d[]>([]);
  const [feeds30d, setFeeds30d] = useState<Feed30d[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const countryName = COUNTRY_NAME_BY_CODE[countryCode?.toUpperCase() || ''] || countryCode || 'Inconnu';
  const coords = africaCountryCenters[countryName];

  const countryLevel = useMemo(() => {
    return alertLevels.find((l) => l.country === countryName) || null;
  }, [alertLevels, countryName]);

  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';

  useEffect(() => {
    if (!countryName || countryName === 'Inconnu') {
      setLoading(false);
      setError(`Pays non trouvé pour le code "${countryCode}"`);
      return;
    }

    const fetch30d = async () => {
      try {
        setLoading(true);
        setError(null);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [alertsRes, feedsRes] = await Promise.all([
          supabase
            .from('alerts')
            .select('*')
            .eq('country', countryName)
            .gte('timestamp', thirtyDaysAgo)
            .order('timestamp', { ascending: false }),
          supabase
            .from('feeds')
            .select('*')
            .eq('country', countryName)
            .gte('timestamp', thirtyDaysAgo)
            .order('timestamp', { ascending: false }),
        ]);

        if (alertsRes.error) throw alertsRes.error;
        if (feedsRes.error) throw feedsRes.error;

        setAlerts30d((alertsRes.data || []) as Alert30d[]);
        setFeeds30d((feedsRes.data || []) as Feed30d[]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetch30d();
  }, [countryName, countryCode]);

  const allIncidents30d: TriggeringIncident[] = useMemo(() => {
    const incidents: TriggeringIncident[] = [];

    alerts30d.forEach((a) => {
      incidents.push({
        id: a.id,
        title: a.title,
        timestamp: a.timestamp,
        severity: (a.severity as TriggeringIncident['severity']) || 'medium',
        type: 'alert',
        locality: a.locality,
        source: a.source,
        verified: a.status === 'active',
        category: a.category,
      });
    });

    feeds30d.forEach((f) => {
      const severity = detectFeedSeverity(f);
      incidents.push({
        id: f.id,
        title: f.title,
        timestamp: f.timestamp,
        severity,
        type: 'feed',
        source: f.source,
        verified: f.verification_status === 'verified',
        category: f.category,
      });
    });

    incidents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return incidents;
  }, [alerts30d, feeds30d]);

  const dailyCounts = useMemo(() => {
    const counts: Record<string, { critical: number; high: number; medium: number; low: number; total: number }> = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      counts[key] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    }

    allIncidents30d.forEach((inc) => {
      const key = inc.timestamp.slice(0, 10);
      if (counts[key]) {
        counts[key][inc.severity]++;
        counts[key].total++;
      }
    });

    return Object.entries(counts).map(([date, d]) => ({ date, ...d }));
  }, [allIncidents30d]);

  const stats30d = useMemo(() => {
    const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
    let verified = 0;
    allIncidents30d.forEach((inc) => {
      bySev[inc.severity]++;
      if (inc.verified) verified++;
    });

    const last14 = dailyCounts.slice(-14);
    const prev14 = dailyCounts.slice(-28, -14);
    const recentTotal = last14.reduce((s, d) => s + d.total, 0);
    const prevTotal = prev14.reduce((s, d) => s + d.total, 0);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendDelta = 0;
    if (prevTotal > 0) {
      trendDelta = Math.round(((recentTotal - prevTotal) / prevTotal) * 100);
      if (trendDelta > 5) trend = 'up';
      else if (trendDelta < -5) trend = 'down';
    } else if (recentTotal > 0) {
      trend = 'up';
      trendDelta = 100;
    }

    return { ...bySev, total: allIncidents30d.length, verified, trend, trendDelta };
  }, [allIncidents30d, dailyCounts]);

  const trendIcon = stats30d.trend === 'up' ? 'ri-arrow-up-line' : stats30d.trend === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line';
  const trendBg = stats30d.trend === 'up' ? 'bg-red-50 text-red-700' : stats30d.trend === 'down' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`${base}/alerts`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-sentiqs-navy transition-colors"
          >
            <i className="ri-arrow-left-line" />
            {t('dashboard.alerts.backToAlerts')}
          </button>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center text-gray-400 text-xs">
          <i className="ri-loader-4-line animate-spin text-2xl mb-2 block" />
          {t('dashboard.alerts.loadingCountry', { country: countryName })}
        </div>
      </div>
    );
  }

  if (error || !countryLevel) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`${base}/alerts`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-sentiqs-navy transition-colors"
          >
            <i className="ri-arrow-left-line" />
            {t('dashboard.alerts.backToAlerts')}
          </button>
        </div>
        <ErrorState
          message={error || t('dashboard.alerts.noCountryData', { country: countryName })}
          onRetry={() => navigate(`${base}/alerts`)}
          retryLabel={t('dashboard.alerts.backToAlerts')}
          icon="ri-error-warning-line"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`${base}/alerts`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-sentiqs-navy transition-colors"
        >
          <i className="ri-arrow-left-line" />
          {t('dashboard.alerts.backToAlerts')}
        </button>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs text-gray-500">{countryName}</span>
      </div>

      {/* Header card */}
      <div className={`rounded-lg border overflow-hidden ${LEVEL_BG[countryLevel.level]}`}>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-white/80 flex items-center justify-center text-xl font-bold tracking-wider text-sentiqs-navy border border-gray-200">
                {countryLevel.countryCode}
              </div>
              <div>
                <h1 className="text-lg font-bold text-sentiqs-navy">{countryLevel.country}</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${LEVEL_COLORS[countryLevel.level]}`}>
                    {countryLevel.level} — {countryLevel.levelLabel}
                  </span>
                  <span className="text-sm font-bold text-sentiqs-navy">
                    Score : <span>{countryLevel.score.toFixed(1)}</span>/100
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${trendBg}`}>
                    <i className={`${trendIcon} text-xs`} />
                    {stats30d.trend === 'up' ? `+${stats30d.trendDelta}%` : stats30d.trend === 'down' ? `${stats30d.trendDelta}%` : t('common.today')}
                    <span className="font-normal ml-0.5">14{t('common.daysAgo')}</span>
                  </span>
                  {countryLevel.coverage === 'aucune_donnee_recente' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-300">
                      <i className="ri-radar-line text-xs" />
                      Aucune donnée récente — niveau non confirmé
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {/* sera connecté plus tard */}}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-download-line" />
                {t('dashboard.alerts.exportPdf')}
              </button>
              <button
                type="button"
                onClick={() => {/* sera connecté plus tard */}}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-sentiqs-navy text-white hover:bg-sentiqs-navy/90 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-notification-3-line" />
                {t('dashboard.alerts.subscribe')}
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-sentiqs-navy">{stats30d.total}</div>
              <div className="text-[9px] text-gray-500">{t('dashboard.alerts.incidents30d')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-red-600">{stats30d.critical}</div>
              <div className="text-[9px] text-gray-500">{t('dashboard.alerts.categories.attack')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-orange-600">{stats30d.high}</div>
              <div className="text-[9px] text-gray-500">{t('common.severity.high')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-yellow-600">{stats30d.medium}</div>
              <div className="text-[9px] text-gray-500">{t('common.severity.medium')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-emerald-600">{stats30d.low}</div>
              <div className="text-[9px] text-gray-500">{t('common.severity.low')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-emerald-600">{stats30d.verified}</div>
              <div className="text-[9px] text-gray-500">{t('common.verifiedCount')}</div>
            </div>
            <div className="bg-white/70 rounded-md px-3 py-2 text-center">
              <div className="text-lg font-bold text-sentiqs-navy">{countryLevel.aggravantsCount}</div>
              <div className="text-[9px] text-gray-500">{t('dashboard.alerts.aggravants')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Justification du niveau — pourquoi ce score, avec preuves à l'appui */}
      <ScoreJustificationPanel
        countryCode={countryLevel.countryCode}
        coverage={countryLevel.coverage}
        corroborationLimited={countryLevel.corroborationLimited}
      />

      {/* Map + Trend side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {coords && (
          <CountryMap
            countryName={countryName}
            lat={coords.lat}
            lng={coords.lng}
          />
        )}
        <TrendChart
          data={dailyCounts}
          trend={stats30d.trend}
          trendDelta={stats30d.trendDelta}
        />
      </div>

      {/* Timeline */}
      <Timeline30d incidents={allIncidents30d} />

      {/* Freshness badge */}
      {countryLevel.freshnessHours !== null && (
        <div className="flex items-center justify-end">
          {countryLevel.freshnessHours <= 6 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('dashboard.alerts.freshIntel', { hours: countryLevel.freshnessHours })}
            </span>
          ) : countryLevel.freshnessHours <= 24 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              {t('dashboard.alerts.updatedHoursAgo', { hours: countryLevel.freshnessHours })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {t('dashboard.alerts.lastInfoDaysAgo', { days: Math.floor(countryLevel.freshnessHours / 24) })}
            </span>
          )}
        </div>
      )}

      {/* Operational panel */}
      <CountryOperationalPanel
        countryName={countryName}
        countryCode={countryCode?.toUpperCase() || ''}
        level={countryLevel.level}
      />
    </div>
  );
}

function detectFeedSeverity(feed: Feed30d): TriggeringIncident['severity'] {
  const fullText = `${feed.title} ${feed.summary || ''}`.toLowerCase();

  if (/massacre|génocide|attentat-suicide|exécutions?\s+sommaires?|décapitation|coup\s+d'état|guerre\s+civile|missile\s+balistique|famine\s+déclarée|\b\d{3,}\s+morts?\b/.test(fullText)) return 'critical';
  if (/attaque\s+terroriste|groupe\s+armé|djihadiste|embuscade|affrontements?\s+armés?|kidnapping|enlèvement|explosion|assassinat|état\s+d'urgence|frappe\s+aérienne|bombardement|prise\s+d'otages?|crimes?\s+de\s+guerre|morts?\s+\d{2,}/.test(fullText)) return 'high';
  if (/manifestation|protestation|tension|instabilité|affrontement|heurts?|mouvement\s+de\s+troupes?|cyberattaque|épidémie|inondation|pénurie|corruption|grève|négociations?\s+de\s+paix|réforme\s+contestée|blessés?/.test(fullText)) return 'medium';

  const highCats = ['Sécurité', 'Terrorisme', 'Défense', 'Trafics illicites'];
  const medCats = ['Humanitaire', 'Politique', 'Diplomatie', 'Cyber', 'Santé', 'Environnement', 'Social'];
  if (highCats.includes(feed.category)) return 'high';
  if (medCats.includes(feed.category)) return 'medium';
  return 'low';
}