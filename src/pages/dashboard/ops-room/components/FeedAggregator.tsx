import { useState } from 'react';
import { ExternalLink, MapPin, ShieldCheck, Clock, ShieldAlert, Eye } from 'lucide-react';
import type { LocalizedFeed } from '@/hooks/useLocalizedFeeds';
import { getFeedSeverity } from '@/hooks/useAlertLevels';
import { categoryBadgeClasses } from '@/utils/categoryColors';
import { isVerifiedData } from '@/utils/dataIntegrity';

interface FeedAggregatorProps {
  supabaseFeeds: LocalizedFeed[];
}

const alertLevelConfig = {
  critical: { bg: 'bg-red-900/20 border-red-800/40 text-red-400', dot: 'bg-red-500', label: 'CRITIQUE' },
  high: { bg: 'bg-orange-900/20 border-orange-800/40 text-orange-400', dot: 'bg-orange-500', label: 'ÉLEVÉ' },
  medium: { bg: 'bg-yellow-900/20 border-yellow-800/40 text-yellow-400', dot: 'bg-yellow-500', label: 'MODÉRÉ' },
  low: { bg: 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400', dot: 'bg-emerald-500', label: 'FAIBLE' },
};

export default function FeedAggregator({ supabaseFeeds }: FeedAggregatorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...supabaseFeeds].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            Flux d'Actualités Aggloméré
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {sorted.length} dépêches — {new Set(sorted.map((f) => f.country)).size} pays — {new Set(sorted.map((f) => f.source)).size} sources
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/20 border border-emerald-800/40 text-[10px] font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Veille active
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun flux ne correspond aux filtres sélectionnés.</p>
          <p className="text-[10px] text-gray-600 mt-1">Modifiez les critères de recherche ou le pays sélectionné.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map((feed) => {
            const alertLevel = getFeedSeverity(feed);
            const level = alertLevelConfig[alertLevel];
            const verified = isVerifiedData({ verification_status: feed.verification_status });
            const isExpanded = expandedId === feed.id;
            const time = new Date(feed.timestamp);
            const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = time.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

            return (
              <div
                key={feed.id}
                className={`bg-[#0f1a2e] rounded-xl border transition-all ${
                  alertLevel === 'critical'
                    ? 'border-red-900/40 hover:border-red-800/60'
                    : alertLevel === 'high'
                    ? 'border-orange-900/20 hover:border-orange-800/40'
                    : 'border-[#1a2d4a] hover:border-gray-700'
                }`}
              >
                <div className="p-4">
                  {/* Header badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${level.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
                      {level.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${categoryBadgeClasses(feed.category)}`}>
                      {feed.category}
                    </span>
                    {verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border bg-emerald-900/20 text-emerald-400 border-emerald-800/40">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Vérifié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border bg-gray-800 text-gray-500 border-gray-700">
                        <Clock className="w-2.5 h-2.5" />
                        En attente
                      </span>
                    )}
                    <span className="text-[9px] text-gray-600 ml-auto whitespace-nowrap font-mono">
                      {dateStr} {timeStr}
                    </span>
                  </div>

                  {/* Title */}
                  <a
                    href={feed.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-bold text-gray-100 leading-snug hover:text-emerald-400 transition-colors cursor-pointer block"
                  >
                    {feed.displayTitle}
                    <ExternalLink className="w-3 h-3 inline ml-1.5 text-gray-600" />
                  </a>

                  {/* Summary — expandable */}
                  {feed.displaySummary && (
                    <div className="mt-2">
                      <p className={`text-xs text-gray-400 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {feed.displaySummary}
                      </p>
                      {feed.displaySummary.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : feed.id)}
                          className="text-[10px] text-emerald-500 hover:text-emerald-400 mt-1 cursor-pointer font-medium"
                        >
                          {isExpanded ? 'Réduire' : 'Lire la suite...'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap pt-3 border-t border-[#1a2d4a]">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded whitespace-nowrap">
                      <MapPin className="w-3 h-3" />
                      {feed.locality ? `${feed.locality}, ` : ''}{feed.country}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border bg-gray-800 text-gray-400 border-gray-700">
                      {feed.source}
                    </span>

                    <a
                      href={feed.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer ml-auto whitespace-nowrap font-medium"
                    >
                      Voir la source →
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
