import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAlertLevels, LEVEL_COLORS } from '@/hooks/useAlertLevels';

const LEVEL_NAMES: Record<string, string> = {
  rouge: 'ROUGE',
  orange: 'ORANGE',
  jaune: 'JAUNE',
  vert: 'VERT',
};

export default function AlertsTable() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
  const [filter, setFilter] = useState('all');
  const { alertLevels, loading, stats } = useAlertLevels();

  const filtered = filter === 'all'
    ? alertLevels
    : alertLevels.filter((l) => l.level === filter);

  const topLevels = filtered.slice(0, 10);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.alerts.latest')}</h3>
        </div>
        <div className="p-8 text-center text-sentiqs-gray-text text-xs">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-sentiqs-navy">{t('dashboard.alerts.alertLevels')}</h3>
          <p className="text-[9px] text-sentiqs-gray-text mt-0.5">
            {stats.totalIncidents} {t('dashboard.incidents')} · 54 {t('dashboard.alerts.africanCountries')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {['all', 'rouge', 'orange', 'jaune', 'vert'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-sentiqs-navy text-white'
                  : 'bg-gray-50 text-sentiqs-gray-text hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? t('dashboard.situation.matrix.all') : LEVEL_NAMES[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.severity')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.alerts.country')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.countries.risk')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase">{t('dashboard.incidents')}</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold tracking-[0.1em] text-sentiqs-gray-text uppercase hidden sm:table-cell">{t('dashboard.alerts.source')}</th>
            </tr>
          </thead>
          <tbody>
            {topLevels.map((level, idx: number) => {
              const latestSource = level.triggeringIncidents[0]?.source;
              return (
              <tr
                key={level.country}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer anim-entry-right"
                style={{ animationDelay: `${idx * 25}ms` }}
                onClick={() => navigate(`${base}/alerts/country/${level.countryCode}`)}
              >
                <td className="px-4 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${LEVEL_COLORS[level.level]}`}>
                    {level.level.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-sentiqs-navy bg-sentiqs-navy/5 px-1.5 py-0.5 rounded">
                      {level.countryCode}
                    </span>
                    <span className="text-[11px] text-sentiqs-navy font-semibold whitespace-nowrap">{level.country}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] font-bold text-sentiqs-navy">{level.score.toFixed(1)}</span>
                  <span className="text-[9px] text-gray-400">/100</span>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-sentiqs-gray-text">
                  {level.incidents}
                  <span className="text-[9px] text-gray-400 ml-1">({level.verifiedCount} {t('common.verifiedCount')})</span>
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {latestSource ? (
                    <a
                      href={`${base}/alerts/country/${level.countryCode}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-sentiqs-blue hover:underline cursor-pointer whitespace-nowrap inline-flex items-center gap-1"
                      title={t('common.viewSource')}
                    >
                      {latestSource}
                      <i className="ri-external-link-line text-[9px]" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-100">
        <a
          href="/dashboard/alerts"
          className="text-xs text-sentiqs-blue hover:text-sentiqs-blue-dark transition-colors font-medium"
        >
          {t('dashboard.alerts.viewAll')} →
        </a>
      </div>
    </div>
  );
}