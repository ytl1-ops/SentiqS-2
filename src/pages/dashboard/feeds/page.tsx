import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import { useVerifiedFeeds, verifyFeedWithAgent, type VerifiedFeed } from '@/hooks/useVerifiedFeeds';
import { useFeedTranslation } from '@/hooks/useFeedTranslation';
import ShareModal from '@/components/feature/ShareModal';
import ErrorState from '@/components/base/ErrorState';
import EmptyState from '@/components/base/EmptyState';
import { LinkStatusBadge } from './components/LinkStatusBadge';
import { categoryBadgeClasses } from '@/utils/categoryColors';
import { formatDateTime } from '@/utils/timeFormat';
import { supabase } from '@/lib/supabase';

const ITEMS_PER_PAGE = 12;

type CorroborationGroup = {
  key: string;
  feeds: VerifiedFeed[];
  sourceCount: number;
};

export default function FeedsPage() {
  const { t, i18n } = useTranslation();
  const { feeds: allFeeds, loading, error, refetch } = useVerifiedFeeds();
  const { translateFeed, translateFeedsBatch, isTranslating, batchProgress } = useFeedTranslation();
  const isEnglish = i18n.language?.startsWith('en');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string; source: string; sourceUrl: string } | null>(null);
  const [page, setPage] = useState(1);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [linkStatusFilter, setLinkStatusFilter] = useState<string>('exploitable');
  const [autoChecking, setAutoChecking] = useState(false);
  const autoCheckDone = useRef(false);
  const [autoCheckTruncated, setAutoCheckTruncated] = useState(false);

  // Batch HTTP verification
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    total: number;
    verified: number;
    unverified: number;
    rumor: number;
    elapsed_seconds: number;
    results: Array<{
      id: string;
      title: string;
      country: string;
      source: string;
      source_status: string;
      verification_status: string;
      hallucination_score: number;
      flags: string[];
    }>;
  } | null>(null);



  const handleBatchVerify = async () => {
    setBatchVerifying(true);
    setBatchResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('batch-verify-feeds', {
        body: { dryRun: false },
      });
      if (fnError) throw fnError;
      setBatchResult(data as typeof batchResult);
      refetch();
    } catch (err) {
      console.error('Batch verify failed:', err);
    } finally {
      setBatchVerifying(false);
    }
  };

  // Integrity Guard — surveillance anti-données factices
  const [integrityRunning, setIntegrityRunning] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    scanned_at: string;
    total_scanned: number;
    violations_found: number;
    auto_fixed: number;
    violations: Array<{
      feed_id: string;
      feed_title: string;
      violation_type: string;
      severity: string;
      detail: string;
      auto_fixed: boolean;
    }>;
    summary: {
      title_as_source: number;
      contradictory_status: number;
      generic_domain: number;
      score_inconsistency: number;
      missing_fields: number;
    };
  } | null>(null);

  const handleIntegrityGuard = async () => {
    setIntegrityRunning(true);
    setIntegrityResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('integrity-guard', {
        body: { dryRun: false, autoFix: true },
      });
      if (fnError) throw fnError;
      setIntegrityResult(data as typeof integrityResult);
      refetch();
    } catch (err) {
      console.error('Integrity guard failed:', err);
    } finally {
      setIntegrityRunning(false);
    }
  };

  // Auto background link check on first mount — only for unchecked feeds
  useEffect(() => {
    if (autoCheckDone.current) return;
    const uncheckedCount = allFeeds.filter((f) => !f.source_status || f.source_status === 'unchecked').length;
    if (uncheckedCount === 0) {
      autoCheckDone.current = true;
      return;
    }
    setAutoChecking(true);
    const runAutoCheck = async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('check-links', {
          body: {},
        });
        if (invokeError) {
          console.warn('[auto-check] check-links invoke error:', invokeError.message);
        }
        if (data?.summary?.truncated) {
          setAutoCheckTruncated(true);
        }
      } catch {
        // Silent — background check failure shouldn't block the UI
      } finally {
        setAutoChecking(false);
        autoCheckDone.current = true;
        refetch();
      }
    };
    // Delay auto-check by 2s so the page renders first
    const timer = setTimeout(runAutoCheck, 2000);
    return () => clearTimeout(timer);
  }, [allFeeds, refetch]);

  // Derived data
  const categories = useMemo(() => {
    const cats = new Set(allFeeds.map((f) => f.category));
    return Array.from(cats).sort();
  }, [allFeeds]);

  const verificationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allFeeds.length, verified: 0, confirmed: 0 };
    allFeeds.forEach((f) => {
      counts[f.verification_status] = (counts[f.verification_status] || 0) + 1;
    });
    return counts;
  }, [allFeeds]);

  const linkStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allFeeds.length, exploitable: 0, active: 0, warning: 0, dead: 0, unchecked: 0 };
    allFeeds.forEach((f) => {
      const s = f.source_status || 'unchecked';
      counts[s] = (counts[s] || 0) + 1;
      if (s === 'active' || s === 'warning') counts.exploitable++;
    });
    return counts;
  }, [allFeeds]);

  // Corroboration detection — group feeds by country+category within same day
  const corroborationMap = useMemo(() => {
    const groups = new Map<string, VerifiedFeed[]>();
    allFeeds.forEach((f) => {
      const day = f.timestamp?.substring(0, 10) || 'unknown';
      const key = `${f.country}|${f.category}|${day}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    });
    const corroborated: CorroborationGroup[] = [];
    groups.forEach((feeds, key) => {
      const uniqueSources = new Set(feeds.map((f) => f.source));
      if (uniqueSources.size >= 2 && feeds.length >= 2) {
        corroborated.push({ key, feeds, sourceCount: uniqueSources.size });
      }
    });
    // Build a set of feed IDs that are corroborated
    const corroboratedIds = new Set<string>();
    corroborated.forEach((g) => g.feeds.forEach((f) => corroboratedIds.add(f.id)));
    return { groups: corroborated, corroboratedIds };
  }, [allFeeds]);

  const filteredFeeds = useMemo(() => {
    let feeds = [...allFeeds];
    if (categoryFilter !== 'all') feeds = feeds.filter((f) => f.category === categoryFilter);
    if (verificationFilter !== 'all') feeds = feeds.filter((f) => f.verification_status === verificationFilter);
    if (linkStatusFilter === 'exploitable') {
      feeds = feeds.filter((f) => f.source_status === 'active' || f.source_status === 'warning');
    } else if (linkStatusFilter !== 'all') {
      feeds = feeds.filter((f) => (f.source_status || 'unchecked') === linkStatusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      feeds = feeds.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.source.toLowerCase().includes(q) ||
          f.country.toLowerCase().includes(q) ||
          f.locality?.toLowerCase().includes(q) ||
          f.department?.toLowerCase().includes(q),
      );
    }
    feeds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return feeds;
  }, [allFeeds, search, categoryFilter, verificationFilter, linkStatusFilter]);

  const totalPages = Math.ceil(filteredFeeds.length / ITEMS_PER_PAGE);
  const paginatedFeeds = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredFeeds.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFeeds, page]);



  const handleVerify = async (feedId: string) => {
    setVerifyingIds((prev) => new Set(prev).add(feedId));
    await verifyFeedWithAgent(feedId);
    setVerifyingIds((prev) => {
      const next = new Set(prev);
      next.delete(feedId);
      return next;
    });
    refetch();
  };



  const openMap = (locality?: string, country?: string) => {
    const query = encodeURIComponent(`${locality || ''}, ${country || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const generateLocalReport = (feed: VerifiedFeed) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(10, 25, 47);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(t('dashboard.feeds.pdfTitle'), 20, 13);

    doc.setFontSize(14);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(feed.title, 170);
    doc.text(titleLines, 20, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 110, 125);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${feed.id}  |  Source: ${feed.source}  |  ${formatDateTime(feed.timestamp, i18n.language)}`, 20, 55);
    if (feed.source_url) {
      doc.setTextColor(40, 80, 160);
      doc.textWithLink(`🔗 ${feed.source_url}`, 20, 62, { url: feed.source_url });
    }

    doc.setFontSize(10);
    doc.setTextColor(40, 50, 70);
    const summaryText = feed.summary || t('dashboard.feeds.noSummary');
    const summaryLines = doc.splitTextToSize(summaryText, 170);
    doc.text(summaryLines, 20, 72);

    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.text(t('dashboard.feeds.meta'), 20, 120);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 70, 90);
    doc.text(`${t('dashboard.feeds.locality')}: ${feed.locality || '-'}`, 20, 128);
    doc.text(`${t('dashboard.feeds.department')}: ${feed.department || '-'}`, 20, 135);
    doc.text(`${t('dashboard.feeds.country')}: ${feed.country}`, 20, 142);
    doc.text(`${t('dashboard.feeds.category')}: ${feed.category}`, 20, 149);
    doc.text(`${t('dashboard.feeds.reliableSource', { percent: ((1 - (feed.hallucination_score ?? 0)) * 100).toFixed(0) })}`, 20, 156);

    const now = new Date();
    const loc = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
    doc.setFontSize(7);
    doc.setTextColor(130, 140, 155);
    doc.text(t('dashboard.feeds.pdfGenerated', {
      date: now.toLocaleDateString(loc),
      time: now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
    }), 20, 280);

    doc.save(`SentiqS_Local_${feed.id}.pdf`);
  };

  // Resolve display content based on current language
  const displayTitle = useCallback((feed: VerifiedFeed): string => {
    if (!isEnglish) return feed.title;
    if (feed.translated_title && feed.translation_lang === 'en') return feed.translated_title;
    if (feed.title_en) return feed.title_en;
    return feed.title;
  }, [isEnglish]);

  const displaySummary = useCallback((feed: VerifiedFeed): string | undefined => {
    if (!isEnglish) return feed.summary;
    if (feed.translated_summary && feed.translation_lang === 'en') return feed.translated_summary;
    return feed.summary;
  }, [isEnglish]);

  // Check if feed needs translation for current language
  const needsTranslation = useCallback((feed: VerifiedFeed): boolean => {
    if (!isEnglish) return false;
    const lang = feed.translation_lang;
    return lang !== 'en' || !feed.translated_title;
  }, [isEnglish]);

  // Handle translate single feed
  const handleTranslateFeed = useCallback(async (feedId: string) => {
    const targetLang = isEnglish ? 'en' : 'fr';
    await translateFeed(feedId, targetLang);
    refetch();
  }, [isEnglish, translateFeed, refetch]);

  // Handle translate all visible feeds
  const handleTranslateAll = useCallback(async () => {
    const toTranslate = allFeeds.filter(needsTranslation).map((f) => f.id);
    if (toTranslate.length === 0) return;
    const targetLang = isEnglish ? 'en' : 'fr';
    await translateFeedsBatch(toTranslate, targetLang);
    refetch();
  }, [allFeeds, needsTranslation, isEnglish, translateFeedsBatch, refetch]);

  const untranslatedCount = useMemo(() => allFeeds.filter(needsTranslation).length, [allFeeds, needsTranslation]);

  const shareFeed = (feed: VerifiedFeed) => {
    setShareTarget({
      id: feed.id,
      title: displayTitle(feed),
      source: feed.source,
      sourceUrl: feed.source_url,
    });
    setShareModalOpen(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-48 mb-2" />
          <div className="h-3 bg-gray-50 rounded w-96" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-5">
        <ErrorState message={error} onRetry={refetch} retryLabel={t('common.retry')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {shareTarget && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setShareTarget(null);
          }}
          itemTitle={shareTarget.title}
          itemType={`Flux ${shareTarget.id}`}
          itemSource={shareTarget.source}
          itemSourceUrl={shareTarget.sourceUrl}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-entry-down">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.feeds')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">
            {filteredFeeds.length} {filteredFeeds.length <= 1 ? t('feeds.activeCount') : t('feeds.activeCountPlural')} — {linkStatusCounts.exploitable} {t('feeds.exploitableLinks')} · {corroborationMap.groups.length} {t('feeds.corroboratedGroups')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-sentiqs-navy text-white' : 'bg-white border border-gray-200 text-sentiqs-gray-text hover:border-gray-300'}`}
          >
            <i className="ri-list-check" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-sentiqs-navy text-white' : 'bg-white border border-gray-200 text-sentiqs-gray-text hover:border-gray-300'}`}
          >
            <i className="ri-layout-grid-line" />
          </button>
        </div>
      </div>

      {/* Sources status bar — background intelligence */}
      <div className="flex items-center gap-3 bg-primary-50/50 border border-primary-200/50 rounded-lg px-4 py-2.5 anim-entry-scale flex-wrap">
        <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-semibold text-primary-800">
          {t('common.activeSource')} — {linkStatusCounts.exploitable}/{allFeeds.length} {t('common.activeSourceDesc')}
        </span>
        {autoChecking && (
          <span className="text-[10px] text-primary-600 flex items-center gap-1">
            <i className="ri-loader-4-line animate-spin" />
            {t('feeds.autoChecking')}
          </span>
        )}
        {autoCheckTruncated && (
          <span className="text-[10px] text-amber-600 flex items-center gap-1">
            <i className="ri-error-warning-line" />
            {t('feeds.autoCheckTruncated')}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Translate All button — only visible in English mode with untranslated feeds */}
          {isEnglish && untranslatedCount > 0 && (
            <button
              type="button"
              onClick={handleTranslateAll}
              disabled={!!batchProgress}
              className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {batchProgress ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-1" />
                  {t('dashboard.feeds.translating')} {batchProgress.done}/{batchProgress.total}...
                </>
              ) : (
                <>
                  <i className="ri-translate-2 mr-1" />
                  {t('dashboard.feeds.translateAll')} ({untranslatedCount})
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 rounded-md bg-white border border-primary-200 text-primary-700 text-[10px] font-semibold hover:bg-primary-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line mr-1" />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            onClick={handleBatchVerify}
            disabled={batchVerifying}
            className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {batchVerifying ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-1" />
                {t('dashboard.feeds.batchVerifying')}
              </>
            ) : (
              <>
                <i className="ri-radar-line mr-1" />
                {t('dashboard.feeds.batchVerify')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleIntegrityGuard}
            disabled={integrityRunning}
            className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            title="Scanner la base à la recherche de données factices (titres=noms de sources, contradictions, URLs génériques)"
          >
            {integrityRunning ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-1" />
                                {t('dashboard.feeds.integrityScanning')}
              </>
            ) : (
              <>
                <i className="ri-shield-flash-line mr-1" />
                {t('dashboard.feeds.integrityScan')}
              </>
            )}
          </button>

        </div>
      </div>

      {/* Batch verify results panel */}
      {batchResult && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden anim-entry-scale">
          {/* Summary header */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <i className="ri-check-double-line text-emerald-600 text-base" />
              <span className="text-xs font-bold text-sentiqs-navy">
                {t('dashboard.feeds.batchComplete', { total: batchResult.total, elapsed: batchResult.elapsed_seconds })}
              </span>
            </div>
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                <i className="ri-shield-check-line" /> {batchResult.verified} {t('common.verifiedBadge')}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
                <i className="ri-question-line" /> {batchResult.unverified} {t('common.unverifiedBadge')}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                <i className="ri-alert-line" /> {batchResult.rumor} {t('common.rumorBadge')}
              </span>
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                className="text-[10px] text-sentiqs-gray-text hover:text-sentiqs-navy cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          </div>
          {/* Results table — scrollable */}
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                <tr className="text-left text-sentiqs-gray-text font-semibold">
                  <th className="px-4 py-2 w-8">#</th>
                  <th className="px-2 py-2">Titre</th>
                  <th className="px-2 py-2 w-20">Pays</th>
                  <th className="px-2 py-2 w-24">Source</th>
                  <th className="px-2 py-2 w-16">Lien</th>
                  <th className="px-2 py-2 w-16">Statut</th>
                  <th className="px-2 py-2 w-12">Score</th>
                  <th className="px-2 py-2">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batchResult.results.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-sentiqs-gray-text">{i + 1}</td>
                    <td className="px-2 py-2 font-medium text-sentiqs-navy max-w-[280px] truncate" title={r.title}>
                      {r.title}
                    </td>
                    <td className="px-2 py-2 text-sentiqs-gray-text">{r.country}</td>
                    <td className="px-2 py-2 text-sentiqs-gray-text max-w-[100px] truncate" title={r.source}>{r.source}</td>
                    <td className="px-2 py-2">
                      {r.source_status === 'active' && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                          <i className="ri-checkbox-circle-fill text-[9px]" /> {t('feeds.linkStatus.activeBadge')}
                        </span>
                      )}
                      {r.source_status === 'warning' && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                          <i className="ri-error-warning-fill text-[9px]" /> {t('feeds.linkStatus.warningBadge')}
                        </span>
                      )}
                      {r.source_status === 'dead' && (
                        <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold">
                          <i className="ri-close-circle-fill text-[9px]" /> {t('feeds.linkStatus.deadBadge')}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {r.verification_status === 'verified' && (
                        <span className="text-emerald-600 font-semibold">{t('common.verifiedBadge')}</span>
                      )}
                      {r.verification_status === 'unverified' && (
                        <span className="text-amber-600 font-semibold">{t('common.unverifiedBadge')}</span>
                      )}
                      {r.verification_status === 'rumor' && (
                        <span className="text-gray-600 font-semibold">{t('common.rumorBadge')}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`font-mono font-semibold ${
                        r.hallucination_score < 0.30 ? 'text-emerald-600' :
                        r.hallucination_score <= 0.60 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {(r.hallucination_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {r.flags.slice(0, 3).map((flag) => (
                          <span key={flag} className="px-1.5 py-0.5 rounded bg-gray-100 text-sentiqs-gray-text text-[8px] font-medium whitespace-nowrap">
                            {flag}
                          </span>
                        ))}
                        {r.flags.length > 3 && (
                          <span className="text-[8px] text-sentiqs-gray-text">+{r.flags.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrity Guard results panel */}
      {integrityResult && (
        <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden anim-entry-scale">
          {/* Summary header */}
          <div className="px-5 py-3 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <i className="ri-shield-flash-line text-emerald-600 text-base" />
              <span className="text-xs font-bold text-sentiqs-navy">
                {t('dashboard.integrity.scanComplete')} — {integrityResult.total_scanned} {t('dashboard.integrity.feedsScanned')}
              </span>
            </div>
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              {integrityResult.violations_found === 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                  <i className="ri-check-line" /> {t('dashboard.integrity.noViolations')}
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                    <i className="ri-error-warning-line" /> {integrityResult.violations_found} violations
                  </span>
                  {integrityResult.auto_fixed > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                      <i className="ri-tools-line" /> {integrityResult.auto_fixed} corrigées automatiquement
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    <i className="ri-file-text-line" /> Titres=noms: {integrityResult.summary.title_as_source}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                    <i className="ri-contrast-drop-2-line" /> {t('dashboard.feeds.integrityContradictions')}: {integrityResult.summary.contradictory_status}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => setIntegrityResult(null)}
                className="text-[10px] text-sentiqs-gray-text hover:text-sentiqs-navy cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          </div>
          {/* Violations detail table */}
          {integrityResult.violations.length > 0 && (
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                  <tr className="text-left text-sentiqs-gray-text font-semibold">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-2 py-2">Flux</th>
                    <th className="px-2 py-2 w-28">Type de violation</th>
                    <th className="px-2 py-2 w-16">Sévérité</th>
                    <th className="px-2 py-2">Détail</th>
                    <th className="px-2 py-2 w-16">Corrigé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {integrityResult.violations.map((v, i) => (
                    <tr key={v.feed_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2 text-sentiqs-gray-text">{i + 1}</td>
                      <td className="px-2 py-2">
                        <span className="font-medium text-sentiqs-navy">{v.feed_id}</span>
                        <span className="text-sentiqs-gray-text ml-1 max-w-[200px] truncate inline-block align-middle" title={v.feed_title}>{v.feed_title}</span>
                      </td>
                      <td className="px-2 py-2">
                        {v.violation_type === 'TITLE_IS_SOURCE_NAME' && (
                          <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold">
                            <i className="ri-file-copy-line text-[9px]" /> {t('dashboard.feeds.violation.titleIsSource')}
                          </span>
                        )}
                        {v.violation_type === 'CONTRADICTORY_STATUS' && (
                          <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold">
                            <i className="ri-contrast-drop-2-line text-[9px]" /> {t('dashboard.feeds.violation.contradiction')}
                          </span>
                        )}
                        {v.violation_type === 'GENERIC_DOMAIN_URL' && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                            <i className="ri-link-unlink text-[9px]" /> {t('dashboard.feeds.violation.genericUrl')}
                          </span>
                        )}
                        {v.violation_type === 'SCORE_INCONSISTENCY' && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                            <i className="ri-scales-line text-[9px]" /> {t('dashboard.feeds.violation.scoreInconsistency')}
                          </span>
                        )}
                        {v.violation_type === 'MISSING_REQUIRED_FIELD' && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                            <i className="ri-edit-line text-[9px]" /> {t('dashboard.feeds.violation.missingFields')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          v.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          v.severity === 'high' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {v.severity === 'critical' ? t('common.severity.critical') : v.severity === 'high' ? t('common.severity.high') : t('common.severity.medium')}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-sentiqs-gray-text max-w-[300px] truncate" title={v.detail}>{v.detail}</td>
                      <td className="px-2 py-2">
                        {v.auto_fixed ? (
                          <span className="text-emerald-600 font-semibold"><i className="ri-check-line" /> {t('common.yes')}</span>
                        ) : (
                          <span className="text-sentiqs-gray-text">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}



      {/* Filters bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder={t('dashboard.feeds.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
            }`}
          >
            {t('dashboard.feeds.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategoryFilter(cat);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'verified', 'confirmed'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVerificationFilter(v);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                verificationFilter === v
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              {t(`dashboard.feeds.verification.${v}`)} ({verificationCounts[v] || 0})
            </button>
          ))}
        </div>

        {/* Link status filter — exploitable by default */}
        <div className="flex gap-2 flex-wrap">
          {(['exploitable', 'all', 'dead', 'unchecked'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setLinkStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                linkStatusFilter === s
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'exploitable' && <>{t('feeds.linkStatus.exploitable')} ({linkStatusCounts.exploitable || 0})</>}
              {s === 'all' && <>{t('feeds.linkStatus.all')} ({linkStatusCounts.all || 0})</>}
              {s === 'dead' && <>{t('feeds.linkStatus.dead')} ({linkStatusCounts.dead || 0})</>}
              {s === 'unchecked' && <>{t('feeds.linkStatus.unchecked')} ({linkStatusCounts.unchecked || 0})</>}
            </button>
          ))}
        </div>
      </div>

      {/* Feeds content */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
          {paginatedFeeds.map((feed, idx) => {
            const isCorroborated = corroborationMap.corroboratedIds.has(feed.id);
            return (
            <div
              key={feed.id}
              className="px-5 py-4 hover:bg-gray-50/50 transition-colors anim-entry-right"
              style={{ animationDelay: `${idx * 15}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-lg bg-sentiqs-navy/5 flex items-center justify-center">
                    <i className="ri-article-line text-sentiqs-navy text-sm" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryBadgeClasses(feed.category)}`}>
                      {feed.category}
                    </span>
                    {(feed.verification_status === 'verified' || feed.verification_status === 'confirmed') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50/70 text-emerald-700 border-emerald-200/60">
                        <i className="ri-check-line text-[9px]" />
                        {feed.verification_status === 'verified' ? t('common.verifiedBadge') : t('common.confirmedBadge')}
                      </span>
                    )}
                    {feed.verification_status === 'unverified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-gray-50 text-gray-400 border-gray-200">
                        <i className="ri-time-line text-[9px]" />
                        {t('common.unverifiedBadge')}
                      </span>
                    )}
                    <LinkStatusBadge feed={feed} />
                    {isCorroborated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-violet-50 text-violet-700 border-violet-200" title={t('feeds.corroboratedTooltip')}>
                        <i className="ri-git-branch-line text-[9px]" />
                        {t('feeds.corroborated')}
                      </span>
                    )}
                    <span className="text-[10px] text-sentiqs-gray-text whitespace-nowrap">{formatDateTime(feed.timestamp, i18n.language)}</span>
                  </div>

                  {/* Title — clickable to source */}
                  <a
                    href={feed.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-semibold text-sentiqs-navy leading-relaxed hover:text-sentiqs-blue transition-colors cursor-pointer block"
                    title={`Lire l'article original sur ${feed.source}`}
                  >
                    {displayTitle(feed)}
                    <i className="ri-external-link-line text-[11px] ml-1.5 align-middle text-sentiqs-gray-text" />
                    {/* Translation badge */}
                    {needsTranslation(feed) && (
                      <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-200 align-middle whitespace-nowrap">
                        <i className="ri-translate-2 text-[8px]" />
                        {t('dashboard.feeds.notTranslated')}
                      </span>
                    )}
                    {isEnglish && !needsTranslation(feed) && feed.translated_title && (
                      <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 align-middle whitespace-nowrap">
                        <i className="ri-check-line text-[8px]" />
                        {t('dashboard.feeds.translated')}
                      </span>
                    )}
                  </a>

                  {/* Summary — full text, no line clamp */}
                  {displaySummary(feed) && (
                    <p className="text-xs text-sentiqs-gray-text mt-1.5 leading-relaxed break-words whitespace-pre-line">
                      {displaySummary(feed)}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {feed.locality && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sentiqs-navy bg-sentiqs-navy/5 px-2 py-0.5 rounded whitespace-nowrap">
                        <i className="ri-map-pin-line text-[9px]" />
                        {feed.locality}
                      </span>
                    )}
                    {feed.department && (
                      <span className="text-[10px] text-sentiqs-gray-text">{feed.department}</span>
                    )}
                    <span className="text-[10px] text-sentiqs-gray-text">{feed.country}</span>
                    {/* Source link */}
                    <a
                      href={feed.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-[10px] text-sentiqs-blue hover:underline cursor-pointer whitespace-nowrap"
                    >
                      {feed.source} →
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {/* Lien vers la source */}
                    <a
                      href={feed.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sentiqs-navy text-white text-[10px] font-semibold hover:bg-sentiqs-navy/90 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-link text-[10px]" />
                      {t('common.viewSource')}
                    </a>
                    {/* Translate button — only when needed */}
                    {needsTranslation(feed) && (
                      <button
                        type="button"
                        onClick={() => handleTranslateFeed(feed.id)}
                        disabled={isTranslating(feed.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isTranslating(feed.id) ? (
                          <>
                            <i className="ri-loader-4-line animate-spin text-[10px]" />
                            {t('dashboard.feeds.translating')}
                          </>
                        ) : (
                          <>
                            <i className="ri-translate-2 text-[10px]" />
                            {t('dashboard.feeds.translateOne')}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => generateLocalReport(feed)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-file-list-3-line text-[10px]" />
                      {t('dashboard.feeds.localReport')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openMap(feed.locality, feed.country)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-map-2-line text-[10px]" />
                      {t('dashboard.feeds.viewMap')}
                    </button>
                    <button
                      type="button"
                      onClick={() => shareFeed(feed)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-share-forward-line text-[10px]" />
                      {t('dashboard.feeds.share')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify(feed.id)}
                      disabled={verifyingIds.has(feed.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-sentiqs-gray-text hover:text-primary-700 transition-colors cursor-pointer whitespace-nowrap ml-auto disabled:opacity-50"
                    >
                      {verifyingIds.has(feed.id) ? (
                        <>
                          <i className="ri-loader-4-line animate-spin text-[10px]" />
                          {t('dashboard.feeds.verifying')}
                        </>
                      ) : (
                        <>
                          <i className="ri-shield-check-line text-[10px]" />
                          {t('common.verifySource')}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Source reliability mini bar */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${((1 - (feed.hallucination_score ?? 0)) * 100).toFixed(0)}%`,
                          backgroundColor:
                            (feed.hallucination_score ?? 0) === 0 ? '#10b981' :
                            (feed.hallucination_score ?? 0) < 0.2 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-[8px] text-sentiqs-gray-text">
                      {t('dashboard.feeds.reliableSource', { percent: ((1 - (feed.hallucination_score ?? 0)) * 100).toFixed(0) })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedFeeds.map((feed, idx) => {
            const isCorroborated = corroborationMap.corroboratedIds.has(feed.id);
            return (
            <div
              key={feed.id}
              className="bg-white rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors anim-entry-scale"
              style={{ animationDelay: `${idx * 15}ms` }}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryBadgeClasses(feed.category)}`}>
                    {feed.category}
                  </span>
                  {(feed.verification_status === 'verified' || feed.verification_status === 'confirmed') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <i className="ri-shield-check-line text-[9px]" />
                      {feed.verification_status === 'verified' ? t('common.verifiedBadge') : t('common.confirmedBadge')}
                    </span>
                  )}
                  {feed.verification_status === 'unverified' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-gray-50 text-gray-400 border-gray-200">
                      <i className="ri-time-line text-[9px]" />
                      {t('common.unverifiedBadge')}
                    </span>
                  )}
                  <LinkStatusBadge feed={feed} />
                  {isCorroborated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-violet-50 text-violet-700 border-violet-200" title={t('feeds.corroboratedTooltip')}>
                      <i className="ri-git-branch-line text-[9px]" />
                      {t('feeds.corroborated')}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-sentiqs-gray-text whitespace-nowrap">{formatDateTime(feed.timestamp, i18n.language)}</span>
              </div>

              {/* Title — clickable to source */}
              <a
                href={feed.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-semibold text-sentiqs-navy leading-relaxed hover:text-sentiqs-blue transition-colors cursor-pointer block mb-1.5"
              >
                {displayTitle(feed)}
                <i className="ri-external-link-line text-[11px] ml-1 align-middle text-sentiqs-gray-text" />
                {needsTranslation(feed) && (
                  <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-200 align-middle whitespace-nowrap">
                    <i className="ri-translate-2 text-[8px]" />
                    Non traduit
                  </span>
                )}
                {isEnglish && !needsTranslation(feed) && feed.translated_title && (
                  <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 align-middle whitespace-nowrap">
                    <i className="ri-check-line text-[8px]" />
                    Traduit
                  </span>
                )}
              </a>

              {displaySummary(feed) && (
                <p className="text-xs text-sentiqs-gray-text leading-relaxed mb-2.5 break-words whitespace-pre-line">{displaySummary(feed)}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {feed.locality && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sentiqs-navy bg-sentiqs-navy/5 px-2 py-0.5 rounded whitespace-nowrap">
                    <i className="ri-map-pin-line text-[9px]" />
                    {feed.locality}
                  </span>
                )}
                <span className="text-[10px] text-sentiqs-gray-text">{feed.country}</span>
                <a
                  href={feed.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[10px] text-sentiqs-blue hover:underline cursor-pointer"
                >
                  {feed.source} →
                </a>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-50">
                <a
                  href={feed.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sentiqs-navy text-white text-[10px] font-semibold hover:bg-sentiqs-navy/90 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-link text-[10px]" />
                  {t('common.viewSource')}
                </a>
                <button
                  type="button"
                  onClick={() => generateLocalReport(feed)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-list-3-line text-[10px]" />
                  {t('dashboard.feeds.localReportShort')}
                </button>
                <button
                  type="button"
                  onClick={() => openMap(feed.locality, feed.country)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-map-2-line text-[10px]" />
                  {t('dashboard.feeds.mapShort')}
                </button>
                <button
                  type="button"
                  onClick={() => shareFeed(feed)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-sentiqs-navy text-[10px] font-semibold hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-share-forward-line text-[10px]" />
                </button>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {paginatedFeeds.length === 0 && !loading && (
        <EmptyState
          icon="ri-inbox-line"
          title={linkStatusFilter === 'exploitable' ? t('feeds.noExploitableTitle') : t('dashboard.feeds.empty')}
          description={linkStatusFilter === 'exploitable' ? t('feeds.noExploitableDesc') : t('dashboard.feeds.emptyDesc')}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-gray-200 text-sentiqs-gray-text hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-s-line" />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) {
              p = i + 1;
            } else if (page <= 4) {
              p = i + 1;
            } else if (page >= totalPages - 3) {
              p = totalPages - 6 + i;
            } else {
              p = page - 3 + i;
            }
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer ${
                  page === p
                    ? 'bg-sentiqs-navy text-white'
                    : 'border border-gray-200 text-sentiqs-gray-text hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-gray-200 text-sentiqs-gray-text hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      )}
    </div>
  );
}