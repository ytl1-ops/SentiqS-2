import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { GisLayer, GisLayerType, GisRiskLevel } from '@/types/strategic';

export default function GisLayerPanel() {
  const { t } = useTranslation();
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<GisLayerType>>(new Set(['red_zone', 'critical_infrastructure', 'hospital', 'embassy', 'evacuation_route']));
  const [selectedLayer, setSelectedLayer] = useState<GisLayer | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .from('gis_layers')
      .select('*')
      .order('risk_level', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setLayers((data || []) as GisLayer[]);
        }
        setLoading(false);
      });
  }, []);

  const toggleType = (type: GisLayerType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const stats = useMemo(() => ({
    total: layers.length,
    active: layers.filter(l => l.is_active).length,
    redZones: layers.filter(l => l.layer_type === 'red_zone').length,
    criticalInfra: layers.filter(l => l.layer_type === 'critical_infrastructure').length,
    hospitals: layers.filter(l => l.layer_type === 'hospital').length,
    embassies: layers.filter(l => l.layer_type === 'embassy').length,
    evacuationRoutes: layers.filter(l => l.layer_type === 'evacuation_route').length,
  }), [layers]);

  const filteredLayers = useMemo(() => {
    return layers.filter(l => activeTypes.has(l.layer_type));
  }, [layers, activeTypes]);

  const layerTypeConfig: Array<{
    type: GisLayerType;
    icon: string;
    color: string;
    bgColor: string;
    labelKey: string;
  }> = [
    { type: 'red_zone', icon: 'ri-error-warning-line', color: 'text-red-600', bgColor: 'bg-red-50', labelKey: 'dataflows.gis.redZones' },
    { type: 'critical_infrastructure', icon: 'ri-building-2-line', color: 'text-amber-600', bgColor: 'bg-amber-50', labelKey: 'dataflows.gis.criticalInfra' },
    { type: 'hospital', icon: 'ri-hospital-line', color: 'text-emerald-600', bgColor: 'bg-emerald-50', labelKey: 'dataflows.gis.hospitals' },
    { type: 'embassy', icon: 'ri-government-line', color: 'text-blue-600', bgColor: 'bg-blue-50', labelKey: 'dataflows.gis.embassies' },
    { type: 'evacuation_route', icon: 'ri-road-map-line', color: 'text-violet-600', bgColor: 'bg-violet-50', labelKey: 'dataflows.gis.evacuationRoutes' },
    { type: 'military_zone', icon: 'ri-shield-line', color: 'text-gray-600', bgColor: 'bg-gray-50', labelKey: 'dataflows.gis.militaryZones' },
    { type: 'custom', icon: 'ri-map-pin-line', color: 'text-gray-500', bgColor: 'bg-gray-50', labelKey: 'dataflows.gis.custom' },
  ];

  const riskColor = (risk: GisRiskLevel | null): string => {
    if (!risk) return 'bg-gray-400';
    const map: Record<GisRiskLevel, string> = {
      critical: 'bg-red-600',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-emerald-500',
    };
    return map[risk] || 'bg-gray-400';
  };

  const riskLabel = (risk: GisRiskLevel | null): string => {
    if (!risk) return '—';
    const map: Record<GisRiskLevel, string> = {
      critical: t('dataflows.gis.critical'),
      high: t('dataflows.gis.high'),
      medium: t('dataflows.gis.medium'),
      low: t('dataflows.gis.low'),
    };
    return map[risk] || risk;
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xl font-bold text-sentiqs-navy">{stats.total}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.gis.totalLayers')}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.redZones}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-red-600 uppercase">{t('dataflows.gis.redZones')}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{stats.hospitals}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-emerald-600 uppercase">{t('dataflows.gis.hospitals')}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{stats.embassies + stats.evacuationRoutes}</p>
          <p className="text-[9px] font-semibold tracking-[0.08em] text-blue-600 uppercase">{t('dataflows.gis.embassiesEvac')}</p>
        </div>
      </div>

      {/* ===== MAP + LAYER TOGGLES ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ minHeight: '480px' }}>
          <div className="relative w-full h-full" style={{ minHeight: '480px' }}>
            <iframe
              title={t('dataflows.gis.mapTitle')}
              src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d25827586.189770546!2d-5.0!3d2.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '480px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full"
            />
            {/* Layer count badge */}
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-200 text-[10px] font-semibold text-sentiqs-navy">
              {activeTypes.size} {t('dataflows.gis.layersActive')} · {filteredLayers.length} {t('dataflows.gis.entities')}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Toggle switches */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[10px] font-bold text-sentiqs-gray-text uppercase tracking-wider mb-3">{t('dataflows.gis.toggleLayers')}</p>
            <div className="space-y-2">
              {layerTypeConfig.map((cfg) => {
                const count = layers.filter(l => l.layer_type === cfg.type).length;
                if (count === 0) return null;
                const isActive = activeTypes.has(cfg.type);
                return (
                  <button
                    key={cfg.type}
                    type="button"
                    onClick={() => toggleType(cfg.type)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left cursor-pointer ${
                      isActive ? `${cfg.bgColor} border border-gray-200` : 'bg-gray-50 opacity-50 hover:opacity-75'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
                      <i className={`${cfg.icon} ${cfg.color} text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-900 block">{t(cfg.labelKey)}</span>
                      <span className="text-[10px] text-sentiqs-gray-text">{count} {t('dataflows.gis.entities')}</span>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-sentiqs-navy' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer list */}
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
            {filteredLayers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayer(selectedLayer?.id === layer.id ? null : layer)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedLayer?.id === layer.id ? 'bg-sentiqs-navy/5 border-l-2 border-sentiqs-navy' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${riskColor(layer.risk_level)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{layer.layer_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-sentiqs-gray-text mt-0.5">
                      <span>{layer.country}</span>
                      <span>·</span>
                      <span>{riskLabel(layer.risk_level)}</span>
                    </div>

                    {selectedLayer?.id === layer.id && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                        {layer.description && (
                          <p className="text-[10px] text-sentiqs-gray-text">{layer.description}</p>
                        )}
                        {layer.label && (
                          <p className="text-[10px] text-sentiqs-gray-text">
                            <span className="font-semibold">{layer.label}</span>
                          </p>
                        )}
                        {layer.facility_type && (
                          <p className="text-[10px] text-sentiqs-gray-text">
                            {t('dataflows.gis.facilityType')}: {layer.facility_type}
                          </p>
                        )}
                        {layer.capacity !== null && layer.capacity !== undefined && (
                          <p className="text-[10px] text-sentiqs-gray-text">
                            {t('dataflows.gis.capacity')}: {layer.capacity} {t('dataflows.gis.beds')}
                          </p>
                        )}
                        {layer.contact_info && typeof layer.contact_info === 'object' && (
                          <div className="space-y-0.5">
                            {(layer.contact_info as Record<string, unknown>).phone && (
                              <a href={`tel:${(layer.contact_info as Record<string, string>).phone}`} className="flex items-center gap-1 text-[10px] text-sentiqs-blue hover:underline">
                                <i className="ri-phone-line" />{(layer.contact_info as Record<string, string>).phone}
                              </a>
                            )}
                            {(layer.contact_info as Record<string, unknown>).email && (
                              <a href={`mailto:${(layer.contact_info as Record<string, string>).email}`} className="flex items-center gap-1 text-[10px] text-sentiqs-blue hover:underline">
                                <i className="ri-mail-line" />{(layer.contact_info as Record<string, string>).email}
                              </a>
                            )}
                          </div>
                        )}
                        {layer.geojson && (
                          <p className="text-[9px] font-mono text-sentiqs-gray-text bg-gray-50 rounded p-1.5 truncate">
                            {(layer.geojson as Record<string, string>).type}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filteredLayers.length === 0 && (
              <div className="p-6 text-center text-[10px] text-sentiqs-gray-text">
                {t('dataflows.gis.noLayers')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}