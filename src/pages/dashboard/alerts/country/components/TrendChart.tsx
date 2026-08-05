import { useTranslation } from 'react-i18next';

interface DailyCount {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

interface Props {
  data: DailyCount[];
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
}

const BAR_COLORS = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-emerald-500',
};

export default function TrendChart({ data, trend, trendDelta }: Props) {
  const { t } = useTranslation();
  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const last7Days = data.slice(-7);
  const prev7Days = data.slice(-14, -7);
  const currentWeekTotal = last7Days.reduce((s, d) => s + d.total, 0);
  const prevWeekTotal = prev7Days.reduce((s, d) => s + d.total, 0);

  const trendIcon = trend === 'up' ? 'ri-arrow-up-line' : trend === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line';
  const trendColor = trend === 'up' ? 'text-red-600 bg-red-50' : trend === 'down' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-50';

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-line-chart-line text-sentiqs-navy text-sm" />
          <span className="text-xs font-bold text-sentiqs-navy">Tendance — 30 jours</span>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${trendColor}`}>
          <i className={`${trendIcon} text-xs`} />
          {trend === 'up' ? `+${trendDelta}%` : trend === 'down' ? `-${trendDelta}%` : 'Stable'}
          <span className="font-normal text-[9px] ml-1">{t('dashboard.trend.vsPrevWeek')}</span>
        </div>
      </div>

      <div className="p-4">
        {/* Bar chart */}
        <div className="flex items-end gap-1 h-40">
          {data.map((day) => {
            const pct = (day.total / maxTotal) * 100;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative"
              >
                <div className="w-full flex flex-col-reverse" style={{ height: '140px' }}>
                  {day.critical > 0 && (
                    <div
                      className={`w-full ${BAR_COLORS.critical} rounded-t-sm transition-opacity group-hover:opacity-80`}
                      style={{ height: `${Math.max((day.critical / maxTotal) * 100, 2)}%` }}
                    />
                  )}
                  {day.high > 0 && (
                    <div
                      className={`w-full ${BAR_COLORS.high} transition-opacity group-hover:opacity-80`}
                      style={{ height: `${Math.max((day.high / maxTotal) * 100, 2)}%` }}
                    />
                  )}
                  {day.medium > 0 && (
                    <div
                      className={`w-full ${BAR_COLORS.medium} transition-opacity group-hover:opacity-80`}
                      style={{ height: `${Math.max((day.medium / maxTotal) * 100, 2)}%` }}
                    />
                  )}
                  {day.low > 0 && (
                    <div
                      className={`w-full ${BAR_COLORS.low} transition-opacity group-hover:opacity-80`}
                      style={{ height: `${Math.max((day.low / maxTotal) * 100, 2)}%` }}
                    />
                  )}
                </div>
                {pct > 0 && (
                  <span className="text-[8px] text-gray-400 font-medium leading-none group-hover:text-gray-600">
                    {day.total}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
            <span className="text-[9px] text-gray-500">{t('dashboard.severity.critical')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
            <span className="text-[9px] text-gray-500">{t('dashboard.severity.high')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />
            <span className="text-[9px] text-gray-500">{t('dashboard.severity.medium')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-[9px] text-gray-500">{t('dashboard.severity.low')}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[9px] text-gray-400">
            <span>{t('dashboard.trend.currentWeek')} : <strong className="text-gray-600">{currentWeekTotal}</strong></span>
            <span>|</span>
            <span>{t('dashboard.trend.previous')} : <strong className="text-gray-600">{prevWeekTotal}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}