import { Calendar, MapPin, Clock, Users, Flag, GraduationCap, Construction, AlertTriangle as AlertTriangleIcon, Heart } from 'lucide-react';
import { getSourceTypeById, SOURCE_COLORS } from '@/data/sourceTypes';
import type { AgendaItem } from '@/data/opsRoomData';

interface AgendaWidgetProps {
  agendaItems: AgendaItem[];
}

const typeIcons: Record<string, React.ReactNode> = {
  fete_nationale: <Flag className="w-3.5 h-3.5" />,
  colloque: <GraduationCap className="w-3.5 h-3.5" />,
  travaux: <Construction className="w-3.5 h-3.5" />,
  election: <Users className="w-3.5 h-3.5" />,
  sommet: <Flag className="w-3.5 h-3.5" />,
  formation: <GraduationCap className="w-3.5 h-3.5" />,
  alerte_sanitaire: <Heart className="w-3.5 h-3.5" />,
};

const typeLabels: Record<string, string> = {
  fete_nationale: 'Fête Nationale',
  colloque: 'Colloque / Séminaire',
  travaux: 'Travaux',
  election: 'Élection',
  sommet: 'Sommet',
  formation: 'Formation / Exercice',
  alerte_sanitaire: 'Alerte Sanitaire',
};

const typeColors: Record<string, string> = {
  fete_nationale: 'bg-blue-900/20 text-blue-400 border-blue-800/40',
  colloque: 'bg-violet-900/20 text-violet-400 border-violet-800/40',
  travaux: 'bg-orange-900/20 text-orange-400 border-orange-800/40',
  election: 'bg-amber-900/20 text-amber-400 border-amber-800/40',
  sommet: 'bg-red-900/20 text-red-400 border-red-800/40',
  formation: 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40',
  alerte_sanitaire: 'bg-rose-900/20 text-rose-400 border-rose-800/40',
};

export default function AgendaWidget({ agendaItems }: AgendaWidgetProps) {
  const sorted = [...agendaItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const todayItems = sorted.filter((a) => a.date === todayStr);
  const upcomingItems = sorted.filter((a) => a.date > todayStr && a.date <= nextWeek);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Agenda & Fêtes
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {sorted.length} événements programmés — {upcomingItems.length} à venir
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aujourd'hui */}
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-4">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Aujourd'hui — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h4>
          {todayItems.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Aucun événement majeur aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayItems.map((item) => {
                const sourceType = getSourceTypeById(item.sourceTypeId);
                return (
                  <AgendaCard key={item.id} item={item} sourceType={sourceType} />
                );
              })}
            </div>
          )}
        </div>

        {/* À venir (7 jours) */}
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-4">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
            7 prochains jours ({upcomingItems.length})
          </h4>
          {upcomingItems.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Aucun événement à venir cette semaine</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingItems.map((item) => {
                const sourceType = getSourceTypeById(item.sourceTypeId);
                return (
                  <AgendaCard key={item.id} item={item} sourceType={sourceType} compact />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tous les événements */}
      {sorted.length > 0 && (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2d4a]">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Calendrier complet ({sorted.length})</h4>
          </div>
          <div className="divide-y divide-[#1a2d4a]">
            {sorted.map((item) => {
              const sourceType = getSourceTypeById(item.sourceTypeId);
              const date = new Date(item.date);
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#1a2232] transition-colors">
                  <div className="w-12 flex-shrink-0 text-center">
                    <div className="text-lg font-black text-emerald-400 font-mono">{date.getDate()}</div>
                    <div className="text-[8px] text-gray-500 uppercase font-semibold">
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${typeColors[item.type] || 'bg-gray-800 text-gray-400'}`}>
                        {typeLabels[item.type] || item.type}
                      </span>
                      <span className="text-[10px] text-gray-400">{item.country}</span>
                    </div>
                    <p className="text-xs text-gray-200 font-medium">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[9px] text-gray-500">
                        <MapPin className="w-2.5 h-2.5" />
                        {item.locality}
                      </span>
                      {sourceType && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${SOURCE_COLORS[sourceType.color]?.split(' ').slice(0, 3).join(' ') || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                          {item.sourceName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaCard({ item, sourceType, compact }: { item: AgendaItem; sourceType?: ReturnType<typeof getSourceTypeById>; compact?: boolean }) {
  return (
    <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-3">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border ${typeColors[item.type] || 'bg-gray-800 text-gray-400'}`}>
          {typeIcons[item.type]}
          {typeLabels[item.type] || item.type}
        </span>
        <span className="text-[10px] text-gray-500">{item.country}</span>
      </div>
      <p className="text-xs text-gray-200 font-semibold leading-snug">{item.title}</p>
      {!compact && item.description && (
        <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{item.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[9px] text-gray-500">
          <MapPin className="w-2.5 h-2.5" />
          {item.locality}
        </span>
        {sourceType && (
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${SOURCE_COLORS[sourceType.color]?.split(' ').slice(0, 3).join(' ') || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {item.sourceName}
          </span>
        )}
      </div>
    </div>
  );
}