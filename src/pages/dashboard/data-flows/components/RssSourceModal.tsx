import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { RssRegisterResponse } from '@/types/strategic';

export interface RssSourceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editSource?: {
    id: number;
    source_name: string;
    source_url: string;
    country: string;
    detection_keywords: string[];
    fetch_interval_minutes: number;
  } | null;
}

const AFRICAN_COUNTRIES = [
  'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso',
  'Burundi', 'Cameroun', 'Cap-Vert', 'Centrafrique', 'Comores', 'Congo',
  'Côte d\'Ivoire', 'Djibouti', 'Égypte', 'Érythrée', 'Éthiopie', 'Gabon',
  'Gambie', 'Ghana', 'Guinée', 'Guinée-Bissau', 'Guinée Équatoriale',
  'Kenya', 'Lesotho', 'Libéria', 'Libye', 'Madagascar', 'Malawi', 'Mali',
  'Maroc', 'Maurice', 'Mauritanie', 'Mozambique', 'Namibie', 'Niger',
  'Nigeria', 'Ouganda', 'RDC', 'Rwanda', 'Sao Tomé-et-Principe',
  'Sénégal', 'Seychelles', 'Sierra Leone', 'Somalie', 'Soudan',
  'Soudan du Sud', 'Éswatini', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie',
  'Zambie', 'Zimbabwe',
];

export default function RssSourceModal({ open, onClose, onSuccess, editSource }: RssSourceModalProps) {
  const { t } = useTranslation();

  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [country, setCountry] = useState('');
  const [keywords, setKeywords] = useState('');
  const [fetchInterval, setFetchInterval] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RssRegisterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState('');

  useEffect(() => {
    if (editSource) {
      setSourceName(editSource.source_name);
      setSourceUrl(editSource.source_url || '');
      setCountry(editSource.country || '');
      setKeywords((editSource.detection_keywords || []).join(', '));
      setFetchInterval(editSource.fetch_interval_minutes || 30);
    } else {
      setSourceName('');
      setSourceUrl('');
      setCountry('');
      setKeywords('');
      setFetchInterval(30);
    }
    setResult(null);
    setError(null);
    setCountrySearch('');
  }, [editSource, open]);

  const filteredCountries = countrySearch
    ? AFRICAN_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
    : AFRICAN_COUNTRIES.slice(0, 10);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const keywordsArray = keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<RssRegisterResponse>(
        'ingest-feed',
        {
          body: {
            mode: 'rss_register',
            source_name: sourceName.trim(),
            source_url: sourceUrl.trim(),
            country,
            detection_keywords: keywordsArray,
            fetch_interval_minutes: fetchInterval,
            osint_source_id: editSource?.id || undefined,
          },
        },
      );

      if (invokeErr) {
        setError(invokeErr.message || t('dataflows.rssModal.genericError'));
        setLoading(false);
        return;
      }

      if (data) {
        setResult(data);
        if (data.success) {
          onSuccess();
        }
      } else {
        setError(t('dataflows.rssModal.noResponse'));
      }
    } catch (err) {
      setError((err as Error).message || t('dataflows.rssModal.genericError'));
    }
    setLoading(false);
  };

  const isValid = sourceName.trim().length >= 2 && sourceUrl.trim().length > 0 && country.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto anim-entry-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sentiqs-navy/10 flex items-center justify-center">
              <i className="ri-rss-line text-sentiqs-navy" />
            </div>
            <h3 className="text-sm font-bold text-sentiqs-navy">
              {editSource ? t('dataflows.rssModal.editTitle') : t('dataflows.rssModal.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-sentiqs-gray-text" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!result && (
            <>
              {/* Source Name */}
              <div>
                <label className="block text-[11px] font-semibold text-sentiqs-navy mb-1.5">
                  {t('dataflows.rssModal.sourceName')}
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder={t('dataflows.rssModal.sourceNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 transition-colors"
                />
              </div>

              {/* RSS URL */}
              <div>
                <label className="block text-[11px] font-semibold text-sentiqs-navy mb-1.5">
                  {t('dataflows.rssModal.rssUrl')}
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={t('dataflows.rssModal.rssUrlPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 transition-colors font-mono text-xs"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-[11px] font-semibold text-sentiqs-navy mb-1.5">
                  {t('dataflows.rssModal.country')}
                </label>
                {country ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 bg-sentiqs-navy/5 rounded-lg text-sm font-semibold text-sentiqs-navy flex-1">
                      {country}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCountry('')}
                      className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer"
                    >
                      <i className="ri-close-line text-xs text-sentiqs-gray-text" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder={t('dataflows.rssModal.countryPlaceholder')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 transition-colors"
                    />
                    {countrySearch && filteredCountries.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                        {filteredCountries.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { setCountry(c); setCountrySearch(''); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-[11px] font-semibold text-sentiqs-navy mb-1.5">
                  {t('dataflows.rssModal.keywords')}
                  <span className="text-sentiqs-gray-text font-normal ml-1">{t('dataflows.rssModal.keywordsHint')}</span>
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={t('dataflows.rssModal.keywordsPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 transition-colors"
                />
              </div>

              {/* Fetch Interval */}
              <div>
                <label className="block text-[11px] font-semibold text-sentiqs-navy mb-1.5">
                  {t('dataflows.rssModal.interval')}
                </label>
                <select
                  value={fetchInterval}
                  onChange={(e) => setFetchInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy focus:ring-1 focus:ring-sentiqs-navy/20 transition-colors bg-white cursor-pointer"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 h</option>
                  <option value={120}>2 h</option>
                  <option value={360}>6 h</option>
                  <option value={720}>12 h</option>
                  <option value={1440}>24 h</option>
                </select>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-500 text-xs" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700">{t('dataflows.rssModal.errorTitle')}</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {result.success ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <i className="ri-check-line text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{t('dataflows.rssModal.successTitle')}</p>
                      <p className="text-[10px] text-emerald-600">{result.message}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-sentiqs-navy">{result.rss.total_articles_in_feed}</p>
                      <p className="text-[9px] text-sentiqs-gray-text uppercase tracking-wider">{t('dataflows.rssModal.articlesFound')}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-sentiqs-navy">{result.rss.matched_articles}</p>
                      <p className="text-[9px] text-sentiqs-gray-text uppercase tracking-wider">{t('dataflows.rssModal.articlesMatched')}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-emerald-700">{result.rss.articles_inserted}</p>
                      <p className="text-[9px] text-sentiqs-gray-text uppercase tracking-wider">{t('dataflows.rssModal.articlesInserted')}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-red-600">{result.rss.alerts_detected}</p>
                      <p className="text-[9px] text-sentiqs-gray-text uppercase tracking-wider">{t('dataflows.rssModal.alertsDetected')}</p>
                    </div>
                  </div>
                  {result.rss.sample_titles.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-800 mb-1.5">{t('dataflows.rssModal.sampleTitles')}</p>
                      <div className="space-y-1">
                        {result.rss.sample_titles.map((title, i) => (
                          <p key={i} className="text-[10px] text-emerald-700 pl-3 border-l-2 border-emerald-300">
                            {title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <i className="ri-error-warning-line text-amber-600" />
                    </div>
                    <p className="text-sm font-bold text-amber-800">{t('dataflows.rssModal.partialTitle')}</p>
                  </div>
                  <p className="text-xs text-amber-700">{result.message || result.reason}</p>
                  {result.errors && (
                    <div className="mt-2 space-y-0.5">
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-[10px] text-amber-600 font-mono">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2.5 rounded-b-2xl">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-sentiqs-navy hover:bg-gray-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            >
              {t('common.close')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-sentiqs-gray-text hover:bg-gray-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="px-5 py-2 text-xs font-bold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer transition-all whitespace-nowrap flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    {t('dataflows.rssModal.parsing')}
                  </>
                ) : (
                  <>
                    <i className="ri-rss-line" />
                    {t('dataflows.rssModal.submit')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}