import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import RssSourceModal, { type RssSourceModalProps } from './RssSourceModal';
import type { OsinSource, OsinSourceType, RssRegisterResponse } from '@/types/strategic';

interface OsinStats {
  totalSources: number;
  activeSources: number;
  totalArticles: number;
  totalAlerts: number;
  avgReliability: number;
  rssValidated: number;
}

interface PollResult {
  success: boolean;
  total_inserted: number;
  total_fetched: number;
  sources_polled: number;
  message?: string;
}

export default function OsinDashboard() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<OsinSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<OsinSourceType | 'all'>('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [rssModalOpen, setRssModalOpen] = useState(false);
  const [rssModalMode, setRssModalMode] = useState<'manual' | 'discover'>('manual');
  const [editSource, setEditSource] = useState<RssSourceModalProps['editSource']>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());
  const [isPollingAll, setIsPollingAll] = useState(false);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const fetchSources = useCallback(() => {
    setLoading(true);
    setError(null);
    supabase
      .from('osint_sources')
      .select('*')
      .order('alerts_triggered', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setSources((data || []) as OsinSource[]);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleRefreshSource = async (source: OsinSource) => {
    if (!source.source_url || refreshingIds.has(source.id)) return;
    setRefreshingIds(prev => new Set(prev).add(source.id));
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<RssRegisterResponse>(
        'ingest-feed',
        {
          body: {
            mode: 'rss_register',
            source_name: source.source_name,
            source_url: source.source_url,
            country: source.country || '',
            detection_keywords: source.detection_keywords || [],
            fetch_interval_minutes: source.fetch_interval_minutes,
            osint_source_id: source.id,
          },
        },
      );
      if (!invokeErr && data?.success) {
        fetchSources();
      }
    } catch {
      // silently fail for background refresh
    }
    setRefreshingIds(prev => {
      const next = new Set(prev);
      next.delete(source.id);
      return next;
    });
  };

  const handlePollAllRss = async () => {
    if (isPollingAll) return;
    setIsPollingAll(true);
    setPollResult(null);
    setPollError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<{
        success: boolean;
        total_inserted: number;
        total_articles_fetched: number;
        sources_polled: number;
        results: Array<{ source_name: string; status: string; inserted: number; error_message?: string }>;
      }>('rss-poll', { body: {} });
      if (invokeErr) {
        setPollError(invokeErr.message || t('dataflows.osint.pollError'));
      } else if (data) {
        setPollResult({
          success: data.success,
          total_inserted: data.total_inserted,
          total_fetched: data.total_articles_fetched,
          sources_polled: data.sources_polled,
        });
        if (data.total_inserted > 0) {
          fetchSources();
        }
      }
    } catch (err) {
      setPollError((err as Error).message || t('dataflows.osint.pollError'));
    }
    setIsPollingAll(false);
  };

  const handleEditSource = (source: OsinSource) => {
    setEditSource({
      id: source.id,
      source_name: source.source_name,
      source_url: source.source_url || '',
      country: source.country || '',
      detection_keywords: source.detection_keywords || [],
      fetch_interval_minutes: source.fetch_interval_minutes,
    });
    setRssModalOpen(true);
  };

  const handleAddRss = () => {
    setEditSource(null);
    setRssModalMode('manual');
    setRssModalOpen(true);
  };

  const handleAddWebsite = () => {
    setEditSource(null);
    setRssModalMode('discover');
    setRssModalOpen(true);
  };

  const stats: OsinStats = useMemo(() => ({
    totalSources: sources.length,
    activeSources: sources.filter(s => s.is_active).length,
    totalArticles: sources.reduce((sum, s) => sum + s.total_articles_fetched, 0),
    totalAlerts: sources.reduce((sum, s) => sum + s.alerts_triggered, 0),
    avgReliability: sources.length > 0
      ? sources.reduce((sum, s) => sum + s.reliability_score, 0) / sources.length
      : 0,
    rssValidated: sources.filter(s => s.rss_validated).length,
  }), [sources]);

  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      if (typeFilter !== 'all' && s.source_type !== typeFilter) return false;
      if (activeOnly && !s.is_active) return false;
      return true;
    });
  }, [sources, typeFilter, activeOnly]);

  const typeLabel = (type: OsinSourceType): string => {
    const map: Record<OsinSourceType, string> = {
      rss: 'RSS',
      social_media: 'Social',
      local_media: 'Média local',
      api_agency: 'API Agence',
      manual: 'Manuel',
    };
    return map[type] || type;
  };

  const typeIcon = (type: OsinSourceType): string => {
    const map: Record<OsinSourceType, string> = {
      rss: 'ri-rss-line',
      social_media: 'ri-twitter-x-line',
      local_media: 'ri-newspaper-line',
      api_agency: 'ri-global-line',
      manual: 'ri-user-add-line',
    };
    return map[type] || 'ri-question-line';
  };

  const reliabilityColor = (score: number): string => {
    if (score >= 0.9) return 'bg-emerald-500';
    if (score >= 0.75) return 'bg-lime-500';
    if (score >= 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('dataflows.osint.justNow');
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} j`;
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
          onClick={fetchSources}
          className="text-xs text-sentiqs-navy underline cursor-pointer"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== STATS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-sentiqs-navy/10 flex items-center justify-center flex-shrink-0">
            <i className="ri-global-line text-sentiqs-navy text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{stats.totalSources}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.totalSources')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-checkbox-circle-line text-emerald-600 text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{stats.activeSources}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.activeSources')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-article-line text-blue-600 text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{formatNumber(stats.totalArticles)}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.articlesTotal')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-line text-red-500 text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{formatNumber(stats.totalAlerts)}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.alertsTriggered')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-check-line text-purple-500 text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{(stats.avgReliability * 100).toFixed(1)}%</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.avgReliability')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <i className="ri-rss-line text-amber-600 text-lg" />
          </div>
          <div>
            <p className="text-xl font-bold text-sentiqs-navy">{stats.rssValidated}</p>
            <p className="text-[9px] font-semibold tracking-[0.08em] text-sentiqs-gray-text uppercase">{t('dataflows.osint.rssValidated')}</p>
          </div>
        </div>
      </div>

      {/* ===== ACTIONS BAR ===== */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
            {(['all', 'rss', 'api_agency', 'local_media', 'social_media'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  typeFilter === f
                    ? 'bg-sentiqs-navy text-white'
                    : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
                }`}
              >
                {f === 'all' ? t('dataflows.osint.allTypes') : typeLabel(f)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-sentiqs-gray-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-sentiqs-navy focus:ring-sentiqs-navy"
            />
            {t('dataflows.osint.activeOnly')}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePollAllRss}
            disabled={isPollingAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-sentiqs-navy bg-white border-2 border-sentiqs-navy hover:bg-sentiqs-navy/5 rounded-full cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`${isPollingAll ? 'ri-loader-4-line animate-spin' : 'ri-rss-line'} text-sm`} />
            {isPollingAll ? t('dataflows.osint.polling') : t('dataflows.osint.pollAll')}
          </button>
          <button
            type="button"
            onClick={handleAddWebsite}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-sentiqs-navy bg-white border-2 border-sentiqs-navy hover:bg-sentiqs-navy/5 rounded-full cursor-pointer transition-all whitespace-nowrap"
          >
            <i className="ri-global-line" />
            {t('dataflows.rssModal.addWebsiteButton')}
          </button>
          <button
            type="button"
            onClick={handleAddRss}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 rounded-full cursor-pointer transition-all whitespace-nowrap"
          >
            <i className="ri-add-line" />
            {t('dataflows.rssModal.addButton')}
          </button>
        </div>
      </div>

      {/* ===== POLL RESULT BANNER ===== */}
      {pollResult && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
          pollResult.total_inserted > 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <i className={`text-lg ${pollResult.total_inserted > 0 ? 'ri-check-double-line text-emerald-500' : 'ri-information-line text-amber-500'}`} />
          <span className="flex-1">
            {pollResult.total_inserted > 0
              ? t('dataflows.osint.pollSuccess', { count: pollResult.total_inserted, sources: pollResult.sources_polled })
              : t('dataflows.osint.pollEmpty')}
          </span>
          <button
            type="button"
            onClick={() => setPollResult(null)}
            className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center cursor-pointer"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      )}
      {pollError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm">
          <i className="ri-error-warning-line text-red-500 text-lg" />
          <span className="flex-1">{pollError}</span>
          <button
            type="button"
            onClick={() => setPollError(null)}
            className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center cursor-pointer"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      )}

      {/* ===== SOURCE CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredSources.map((source, idx) => (
          <div
            key={source.id}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors anim-entry-scale"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  source.is_active ? 'bg-sentiqs-navy/10' : 'bg-gray-100'
                }`}>
                  <i className={`${typeIcon(source.source_type)} ${
                    source.is_active ? 'text-sentiqs-navy' : 'text-gray-400'
                  } text-sm`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{source.source_name}</span>
                    {source.rss_validated && (
                      <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0" title={t('dataflows.osint.rssValidated')}>
                        <i className="ri-check-line text-emerald-600 text-[8px]" />
                      </span>
                    )}
                    {!source.is_active && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-gray-100 text-gray-500 uppercase whitespace-nowrap">
                        {t('dataflows.osint.inactive')}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-sentiqs-gray-text">{typeLabel(source.source_type)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleRefreshSource(source)}
                  disabled={refreshingIds.has(source.id) || !source.source_url}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('dataflows.osint.refreshSource')}
                >
                  <i className={`ri-refresh-line text-sentiqs-gray-text text-sm ${refreshingIds.has(source.id) ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleEditSource(source)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
                  title={t('dataflows.osint.editSource')}
                >
                  <i className="ri-pencil-line text-sentiqs-gray-text text-xs" />
                </button>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${source.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-[10px] text-sentiqs-gray-text">{source.fetch_interval_minutes}min</span>
                </div>
              </div>
            </div>

            {/* Reliability bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-sentiqs-gray-text">{t('dataflows.osint.reliability')}</span>
                <span className="text-[10px] font-bold text-gray-700">{(source.reliability_score * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${reliabilityColor(source.reliability_score)} transition-all`}
                  style={{ width: `${source.reliability_score * 100}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-[10px] text-sentiqs-gray-text mb-2">
              <span className="flex items-center gap-1">
                <i className="ri-article-line" />
                {formatNumber(source.total_articles_fetched)} {t('dataflows.osint.articles')}
              </span>
              <span className="flex items-center gap-1">
                <i className="ri-alarm-line" />
                {formatNumber(source.alerts_triggered)} {t('dataflows.osint.alerts')}
              </span>
            </div>

            {/* Last fetched */}
            <div className="flex items-center gap-1 text-[10px] text-sentiqs-gray-text mb-3">
              <i className="ri-time-line" />
              <span>{t('dataflows.osint.lastFetched')}: {timeAgo(source.last_fetched_at)}</span>
              {source.nb_articles_last_check != null && (
                <span className="text-sentiqs-navy font-semibold ml-1">(+{source.nb_articles_last_check})</span>
              )}
            </div>

            {/* Keywords */}
            {(source.detection_keywords?.length > 0) && (
              <div className="flex items-center gap-1 flex-wrap">
                {source.detection_keywords.slice(0, 4).map((kw: string) => (
                  <span
                    key={kw}
                    className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-600 font-mono"
                  >
                    {kw}
                  </span>
                ))}
                {source.detection_keywords.length > 4 && (
                  <span className="text-[9px] text-sentiqs-gray-text">
                    +{source.detection_keywords.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Source URL — cliquable uniquement si le flux RSS a été validé et la source est active */}
            {source.source_url && source.rss_validated && source.is_active ? (
              <a
                href={source.source_url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-[10px] text-sentiqs-blue hover:underline truncate"
              >
                <i className="ri-links-line" />
                <span className="truncate">{source.source_url}</span>
              </a>
            ) : source.source_url && (
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-400 truncate" title={t('dataflows.osint.notValidated', 'Lien non vérifié — non cliquable')}>
                <i className="ri-link-unlink-m" />
                <span className="truncate">{source.source_url}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSources.length === 0 && (
        <div className="text-center py-16 text-sentiqs-gray-text">
          <i className="ri-inbox-line text-3xl block mb-2" />
          <p className="text-sm">{t('dataflows.osint.noSources')}</p>
        </div>
      )}

      {/* RSS Source Modal */}
      <RssSourceModal
        open={rssModalOpen}
        onClose={() => { setRssModalOpen(false); setEditSource(null); }}
        onSuccess={() => { fetchSources(); }}
        editSource={editSource}
        initialMode={rssModalMode}
      />
    </div>
  );
}