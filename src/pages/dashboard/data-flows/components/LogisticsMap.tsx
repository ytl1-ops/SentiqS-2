import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { LogisticsStatus, LogisticsEntityType, OperationalStatus } from '@/types/strategic';
import { validateSourceUrl } from '@/utils/dataIntegrity';

export default function LogisticsMap() {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<LogisticsStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<LogisticsEntityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | 'all'>('all');
  const [selectedEntity, setSelectedEntity] = useState<LogisticsStatus | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .from('logistics_status')
      .select('*')
      .order('last_report_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setEntities((data || []) as LogisticsStatus[]);
        }
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => ({
    total: entities.length,
    normal: entities.filter(e => e.operational_status === 'normal').length,
    degraded: entities.filter(e => e.operational_status === 'degraded').length,
    closed: entities.filter(e => e.operational_status === 'closed').length,
  }), [entities]);

  const filtered = useMemo(() => {
    return entities.filter(e => {
      if (typeFilter !== 'all' && e.entity_type !== typeFilter) return false;
      if (statusFilter !== 'all' && e.operational_status !== statusFilter) return false;
      return true;
    });
  }, [entities, typeFilter, statusFilter]);

  const entityTypeLabel = (type: LogisticsEntityType): string => {
    const map: Record<LogisticsEntityType, string> = {
      port: t('dataflows.logistics.port'),
      airport: t('dataflows.logistics.airport'),
      border_crossing: t('dataflows.logistics.border'),
      road_axis: t('dataflows.logistics.road'),
      checkpoint: t('dataflows.logistics.checkpoint'),
      base_vie: t('dataflows.logistics.base'),
      warehouse: t('dataflows.logistics.warehouse'),
    };
    return map[type] || type;
  };

  const entityTypeIcon = (type: LogisticsEntityType): string => {
    const map: Record<LogisticsEntityType, string> = {
      port: 'ri-anchor-line',
      airport: 'ri-flight-takeoff-line',
      border_crossing: 'ri-passport-line',
      road_axis: 'ri-road-map-line',
      checkpoint: 'ri-police-car-line',
      base_vie: 'ri-home-gear-line',
      warehouse: 'ri-store-2-line',
    };
    return map[type] || 'ri-map-pin-line';
  };

  const statusColor = (status: OperationalStatus): string => {
    const map: Record<OperationalStatus, string> = {
      normal: 'bg-emerald-500',
      degraded: 'bg-amber-500',
      closed: 'bg-red-500',
      unknown: 'bg-gray-400',
    };
    return map[status] || 'bg-gray-400';
  };

  const statusLabel = (status: OperationalStatus): string => {
    const map: Record<OperationalStatus, string> = {
      normal: t('dataflows.logistics.normal'),
      degraded: t('dataflows.logistics.degraded'),
      closed: t('dataflows.logistics.closed'),
      unknown: t('dataflows.logistics.unknown'),
    };
    return map[status] || status;
  };

  const roadViabilityLabel = (v: string | null): string => {
    if (!v) return '—';
    const map: Record<string, string> = {
      good: t('dataflows.logistics.roadGood'),
      moderate: t('dataflows.logistics.roadModerate'),
      poor: t('dataflows.logistics.roadPoor'),
      impassable: t('dataflows.logistics.roadImpassable'),
    };
    return map[v] || v;
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
    return `${Math.floor(diffMin / 1440)}j`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-sentiqs-gray-text">
          <i className="ri-loader-4-line animate-spin text-lg" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <i className="ri-error-warning-line text-red-500 text-lg" />
        </div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs text-sentiqs-navy underline cursor-pointer"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== STATS ===== */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xl font-bold text-sentiqs-navy">{stats.total}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.logistics.total')}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{stats.normal}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-emerald-600 uppercase">{t('dataflows.logistics.normal')}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{stats.degraded}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-amber-600 uppercase">{t('dataflows.logistics.degraded')}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.closed}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-red-600 uppercase">{t('dataflows.logistics.closed')}</p>
        </div>
      </div>

      {/* ===== MAP + SIDEBAR ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ minHeight: '450px' }}>
          <iframe
            title={t('dataflows.logistics.mapTitle')}
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d25827586.189770546!2d-5.0!3d2.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1"
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: '450px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
            <p className="text-[10px] font-bold text-sentiqs-gray-text uppercase tracking-wider">{t('dataflows.logistics.filters')}</p>
            <div className="flex flex-wrap gap-1">
              {(['all', 'port', 'airport', 'border_crossing', 'road_axis', 'base_vie'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTypeFilter(f)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    typeFilter === f ? 'bg-sentiqs-navy text-white' : 'bg-gray-100 text-sentiqs-gray-text hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? t('dataflows.logistics.all') : entityTypeLabel(f)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'normal', 'degraded', 'closed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === f ? 'bg-sentiqs-navy text-white' : 'bg-gray-100 text-sentiqs-gray-text hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? t('dataflows.logistics.all') : statusLabel(f)}
                </button>
              ))}
            </div>
          </div>

          {/* Entity list */}
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
            {filtered.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => setSelectedEntity(selectedEntity?.id === entity.id ? null : entity)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedEntity?.id === entity.id ? 'bg-sentiqs-navy/5 border-l-2 border-sentiqs-navy' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <i className={`${entityTypeIcon(entity.entity_type)} text-sm text-gray-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900 truncate">{entity.entity_name}</span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(entity.operational_status)}`} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-sentiqs-gray-text mt-0.5">
                      <span>{entity.country}</span>
                      <span>·</span>
                      <span>{statusLabel(entity.operational_status)}</span>
                      <span>·</span>
                      <span>{formatTime(entity.last_report_at)}</span>
                    </div>

                    {/* Expanded detail */}
                    {selectedEntity?.id === entity.id && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5 text-[10px]">
                        {entity.status_details && (
                          <p className="text-sentiqs-gray-text">{entity.status_details}</p>
                        )}
                        {entity.road_viability && (
                          <p className="text-sentiqs-gray-text">
                            {t('dataflows.logistics.roadViability')}: <span className="font-semibold">{roadViabilityLabel(entity.road_viability)}</span>
                          </p>
                        )}
                        {entity.weather_conditions && (
                          <p className="text-sentiqs-gray-text">
                            {t('dataflows.logistics.weather')}: {entity.weather_conditions}
                          </p>
                        )}
                        {entity.gps_lat && entity.gps_lng && (
                          <p className="text-sentiqs-gray-text font-mono">
                            {entity.gps_lat.toFixed(4)}, {entity.gps_lng.toFixed(4)}
                          </p>
                        )}
                        {entity.reported_by && (
                          <p className="text-sentiqs-gray-text">
                            {t('dataflows.logistics.reportedBy')}: {entity.reported_by}
                          </p>
                        )}
                        {entity.contact_phone && (
                          <a href={`tel:${entity.contact_phone}`} className="flex items-center gap-1 text-sentiqs-blue hover:underline">
                            <i className="ri-phone-line" />{entity.contact_phone}
                          </a>
                        )}
                        {entity.contact_email && (
                          <a href={`mailto:${entity.contact_email}`} className="flex items-center gap-1 text-sentiqs-blue hover:underline">
                            <i className="ri-mail-line" />{entity.contact_email}
                          </a>
                        )}
                        {entity.source_url && validateSourceUrl(entity.source_url) && (
                          <a
                            href={entity.source_url}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            className="flex items-center gap-1 text-sentiqs-blue hover:underline"
                            title={t('dataflows.logistics.sourceUrlUnverifiedHint', 'Lien non vérifié automatiquement — vivacité non garantie')}
                          >
                            <i className="ri-links-line" />{t('dataflows.logistics.sourceUrl')}
                            <span className="text-[9px] text-sentiqs-gray-text">({t('dataflows.logistics.unverified', 'non vérifié')})</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-[10px] text-sentiqs-gray-text">
                {t('dataflows.logistics.noResults')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}