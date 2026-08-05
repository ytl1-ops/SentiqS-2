import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import VerificationBadge from '@/components/base/VerificationBadge';
import { SEVERITY_DOT, SEVERITY_LABEL } from '@/utils/severityColors';

export interface TimelineIncident {
  id: string;
  title: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'alert' | 'feed';
  locality?: string;
  source: string;
  verified: boolean;
  category: string;
}

interface Props {
  incidents: TimelineIncident[];
}

function groupByDate(incidents: TimelineIncident[]): Record<string, TimelineIncident[]> {
  const groups: Record<string, TimelineIncident[]> = {};
  const loc = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  incidents.forEach((inc) => {
    const date = new Date(inc.timestamp).toLocaleDateString(loc, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(inc);
  });
  return groups;
}

export default function Timeline30d({ incidents }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/preview') ? '/preview' : '/dashboard';
  const [showAll, setShowAll] = useState(false);

  if (incidents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        <div className="px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <i className="ri-history-line text-sentiqs-navy text-sm" />
          <span className="text-xs font-bold text-sentiqs-navy">{t('dashboard.timeline30d.title', 'Historique — 30 jours')}</span>
        </div>
        <div className="p-8 text-center text-gray-400 text-xs">
          <i className="ri-shield-check-line text-2xl mb-2 block text-gray-300" />
          {t('dashboard.timeline30d.empty')}
        </div>
      </div>
    );
  }

  const groups = groupByDate(incidents);
  const dates = Object.keys(groups).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  });

  const displayedDates = showAll ? dates : dates.slice(0, 7);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-history-line text-sentiqs-navy text-sm" />
          <span className="text-xs font-bold text-sentiqs-navy">
            {t('dashboard.timeline30d.title', 'Historique — 30 jours')}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {incidents.length} {t('dashboard.timeline30d.incidents')} · {dates.length} {t('dashboard.timeline30d.activeDays')}
        </span>
      </div>

      <div className="p-4">
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

          <div className="space-y-6">
            {displayedDates.map((date) => (
              <div key={date} className="relative pl-8">
                <div className="absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full bg-sentiqs-navy/10 border-2 border-white flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-sentiqs-navy" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-sentiqs-navy">{date}</span>
                  <span className="text-[10px] text-gray-400 ml-2">
                    {groups[date].length} {t('dashboard.timeline30d.incident', { count: groups[date].length })}
                  </span>
                </div>

                <div className="mt-2 space-y-2">
                  {groups[date].map((inc) => (
                    <div
                      key={inc.id}
                      className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[inc.severity]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-gray-800 leading-snug break-words">
                            {inc.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {inc.verified ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-700">
                                {t('common.verifiedBadge')}
                              </span>
                            ) : (
                              <VerificationBadge verificationStatus="unverified" size="sm" />
                            )}
                            {/* Source — clickable link per Directive 2 */}
                            <a
                              href={`${base}/feeds`}
                              className="inline-flex items-center gap-0.5 text-[9px] text-sentiqs-blue hover:underline cursor-pointer"
                              title={t('common.viewSource')}
                            >
                              <i className="ri-links-line text-[8px]" />
                              {inc.source}
                            </a>
                            {inc.locality && (
                              <span className="text-[9px] text-gray-400">
                                <i className="ri-map-pin-line mr-0.5" />{inc.locality}
                              </span>
                            )}
                            <span className="text-[9px] font-semibold uppercase text-gray-500">{SEVERITY_LABEL[inc.severity]}</span>
                            <span className="text-[9px] text-gray-400">
                              {new Date(inc.timestamp).toLocaleTimeString(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {dates.length > 7 && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-[11px] font-semibold text-sentiqs-navy hover:text-sentiqs-blue transition-colors flex items-center gap-1 mx-auto"
            >
              {showAll ? (
                <>
                  <i className="ri-arrow-up-s-line" />
                  {t('dashboard.timeline30d.collapse', 'Réduire (7 derniers jours)')}
                </>
              ) : (
                <>
                  <i className="ri-arrow-down-s-line" />
                  {t('dashboard.timeline30d.showPrevious', { count: dates.length - 7 })}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}