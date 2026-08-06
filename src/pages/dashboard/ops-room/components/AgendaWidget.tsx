import { Calendar, MapPin, Users, GraduationCap, Radar, ShieldAlert, Megaphone, FileSearch, PresentationIcon, Timer, Flag } from 'lucide-react';
import type { LocalizedAgendaEvent } from '@/hooks/useLocalizedAgenda';

interface AgendaWidgetProps {
  agendaItems: LocalizedAgendaEvent[];
}

const typeIcons: Record<string, React.ReactNode> = {
  meeting: <Users className="w-3.5 h-3.5" />,
  exercise: <ShieldAlert className="w-3.5 h-3.5" />,
  conference: <Megaphone className="w-3.5 h-3.5" />,
  audit: <FileSearch className="w-3.5 h-3.5" />,
  briefing: <PresentationIcon className="w-3.5 h-3.5" />,
  training: <GraduationCap className="w-3.5 h-3.5" />,
  deadline: <Timer className="w-3.5 h-3.5" />,
  mission: <Radar className="w-3.5 h-3.5" />,
  anniversary: <Flag className="w-3.5 h-3.5" />,
};

const typeLabels: Record<string, string> = {
  meeting: 'Réunion',
  exercise: 'Exercice',
  conference: 'Conférence',
  audit: 'Audit',
  briefing: 'Briefing',
  training: 'Formation',
  deadline: 'Échéance',
  mission: 'Mission',
  anniversary: 'Date sensible',
};

const typeColors: Record<string, string> = {
  meeting: 'bg-blue-900/20 text-blue-400 border-blue-800/40',
  exercise: 'bg-red-900/20 text-red-400 border-red-800/40',
  conference: 'bg-violet-900/20 text-violet-400 border-violet-800/40',
  audit: 'bg-amber-900/20 text-amber-400 border-amber-800/40',
  briefing: 'bg-indigo-900/20 text-indigo-400 border-indigo-800/40',
  training: 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40',
  deadline: 'bg-orange-900/20 text-orange-400 border-orange-800/40',
  mission: 'bg-rose-900/20 text-rose-400 border-rose-800/40',
  anniversary: 'bg-teal-900/20 text-teal-400 border-teal-800/40',
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
            Agenda
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
              {todayItems.map((item) => (
                <AgendaCard key={item.id} item={item} />
              ))}
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
              {upcomingItems.map((item) => (
                <AgendaCard key={item.id} item={item} compact />
              ))}
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
                    <p className="text-xs text-gray-200 font-medium">{item.displayTitle}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.location && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-gray-500">
                          <MapPin className="w-2.5 h-2.5" />
                          {item.location}
                        </span>
                      )}
                      {item.organizer && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold border bg-gray-800 text-gray-400 border-gray-700">
                          {item.organizer}
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

function AgendaCard({ item, compact }: { item: LocalizedAgendaEvent; compact?: boolean }) {
  return (
    <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-3">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border ${typeColors[item.type] || 'bg-gray-800 text-gray-400'}`}>
          {typeIcons[item.type]}
          {typeLabels[item.type] || item.type}
        </span>
        <span className="text-[10px] text-gray-500">{item.country}</span>
      </div>
      <p className="text-xs text-gray-200 font-semibold leading-snug">{item.displayTitle}</p>
      {!compact && item.displayDescription && (
        <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{item.displayDescription}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {item.location && (
          <span className="inline-flex items-center gap-1 text-[9px] text-gray-500">
            <MapPin className="w-2.5 h-2.5" />
            {item.location}
          </span>
        )}
        {item.organizer && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold border bg-gray-800 text-gray-400 border-gray-700">
            {item.organizer}
          </span>
        )}
      </div>
    </div>
  );
}
