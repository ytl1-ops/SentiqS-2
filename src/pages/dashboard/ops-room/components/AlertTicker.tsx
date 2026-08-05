import { AlertTriangle, MapPin } from 'lucide-react';
import { getSourceTypeById, SOURCE_COLORS } from '@/data/sourceTypes';
import type { OpsFeed } from '@/data/opsRoomData';

interface AlertTickerProps {
  feeds: OpsFeed[];
}

export default function AlertTicker({ feeds }: AlertTickerProps) {
  const criticals = feeds.filter((f) => f.alertLevel === 'critical');
  const highs = feeds.filter((f) => f.alertLevel === 'high' && f.alertLevel !== 'critical');

  if (feeds.length === 0) return null;

  return (
    <div className="bg-[#0f1a2e] border border-[#1a2d4a] rounded-lg overflow-hidden">
      <div className="flex items-center h-9">
        {/* Badge fixe */}
        <div className="flex items-center gap-2 bg-red-900/30 border-r border-red-800/50 px-4 h-full flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider whitespace-nowrap">
            Alerte {criticals.length + highs.length} actives
          </span>
        </div>

        {/* Ticker défilant */}
        <div className="flex-1 overflow-hidden relative h-full">
          <div className="animate-marquee flex items-center h-full whitespace-nowrap">
            {[...feeds, ...feeds, ...feeds].map((feed, idx) => {
              const sourceType = getSourceTypeById(feed.sourceTypeId);
              return (
                <span key={`${feed.id}-${idx}`} className="inline-flex items-center gap-2 mr-8">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    feed.alertLevel === 'critical'
                      ? 'bg-red-900/40 text-red-400 border border-red-800/40'
                      : 'bg-amber-900/40 text-amber-400 border border-amber-800/40'
                  }`}>
                    {feed.alertLevel === 'critical' ? 'CRITIQUE' : 'ÉLEVÉ'}
                  </span>
                  <span className="text-xs text-gray-300 font-medium">{feed.title}</span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-500">
                    <MapPin className="w-2.5 h-2.5" />
                    {feed.locality}, {feed.country}
                  </span>
                  {sourceType && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${SOURCE_COLORS[sourceType.color]?.split(' ')[0] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {feed.sourceName}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 px-3 border-l border-[#1a2d4a] h-full flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-gray-500 font-mono whitespace-nowrap">
            {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}