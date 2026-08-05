import { Shield, User, MapPin, Clock, AlertTriangle, Phone, MessageCircle, Send } from 'lucide-react';
import type { FieldAgent } from '@/data/opsRoomData';

interface DutyOfCareProps {
  agents: FieldAgent[];
}

const statusConfig = {
  safe: { bg: 'bg-emerald-900/20', dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'En sécurité' },
  caution: { bg: 'bg-amber-900/20', dot: 'bg-amber-500', text: 'text-amber-400', label: 'Vigilance renforcée' },
  danger: { bg: 'bg-red-900/20', dot: 'bg-red-500 animate-pulse', text: 'text-red-400', label: 'En danger !' },
  offline: { bg: 'bg-gray-800', dot: 'bg-gray-600', text: 'text-gray-500', label: 'Hors ligne' },
};

export default function DutyOfCare({ agents }: DutyOfCareProps) {
  const safeCount = agents.filter((a) => a.status === 'safe').length;
  const cautionCount = agents.filter((a) => a.status === 'caution').length;
  const dangerCount = agents.filter((a) => a.status === 'danger').length;
  const offlineCount = agents.filter((a) => a.status === 'offline').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Duty of Care — Protection Terrain
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {agents.length} agents déployés — Suivi en temps réel des zones à risque
          </p>
        </div>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0f1a2e] rounded-lg border border-[#1a2d4a] p-3">
          <div className="text-xl font-black text-emerald-400 font-mono">{safeCount}</div>
          <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">En sécurité</div>
        </div>
        <div className="bg-[#0f1a2e] rounded-lg border border-[#1a2d4a] p-3">
          <div className="text-xl font-black text-amber-400 font-mono">{cautionCount}</div>
          <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mt-0.5">Vigilance</div>
        </div>
        <div className="bg-[#0f1a2e] rounded-lg border border-red-900/40 p-3">
          <div className="text-xl font-black text-red-400 font-mono">{dangerCount}</div>
          <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mt-0.5">En danger</div>
        </div>
        <div className="bg-[#0f1a2e] rounded-lg border border-[#1a2d4a] p-3">
          <div className="text-xl font-black text-gray-500 font-mono">{offlineCount}</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Hors ligne</div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((agent) => {
          const status = statusConfig[agent.status];
          const lastCheckin = new Date(agent.lastCheckin);
          const hoursSince = Math.round((Date.now() - lastCheckin.getTime()) / (1000 * 60 * 60));

          return (
            <div
              key={agent.id}
              className={`bg-[#0f1a2e] rounded-xl border p-4 ${
                agent.status === 'danger'
                  ? 'border-red-900/40'
                  : agent.status === 'offline'
                  ? 'border-gray-800'
                  : 'border-[#1a2d4a]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${status.bg} flex items-center justify-center`}>
                    <User className={`w-5 h-5 ${status.text}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-100">{agent.name}</div>
                    <div className="text-[10px] text-gray-500">{agent.role}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold border ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <MapPin className="w-3 h-3 text-gray-600" />
                  {agent.locality}, {agent.country}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <Clock className="w-3 h-3 text-gray-600" />
                  Dernier pointage : {lastCheckin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {hoursSince > 6 && (
                    <span className="text-amber-500 font-semibold">(il y a {hoursSince}h)</span>
                  )}
                  {hoursSince > 24 && (
                    <span className="text-red-500 font-semibold">(CRITIQUE — {hoursSince}h)</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                  <Shield className="w-3 h-3" />
                  {agent.zone}
                </div>
              </div>

              {/* Actions rapides */}
              <div className="flex items-center gap-2 pt-3 border-t border-[#1a2d4a]">
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-900/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle className="w-3 h-3" />
                  Message
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a2232] border border-[#273449] text-gray-400 text-[10px] font-semibold hover:border-gray-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Phone className="w-3 h-3" />
                  Appeler
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-[10px] font-semibold hover:bg-red-900/30 transition-colors cursor-pointer whitespace-nowrap ml-auto"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Alerter
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification rapide */}
      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-4">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-emerald-400" />
          Notification d'urgence groupée
        </h4>
        <div className="flex items-center gap-3">
          <select className="flex-1 bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50">
            <option value="">Sélectionner les agents à notifier...</option>
            <option value="all">Tous les agents (8)</option>
            <option value="danger">Agents en danger (1)</option>
            <option value="caution">Agents en vigilance (2)</option>
            <option value="region-sahel">Zone Sahel (3)</option>
            <option value="region-golfe">Zone Golfe de Guinée (2)</option>
          </select>
          <select className="w-40 bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50">
            <option value="sms">Par SMS</option>
            <option value="push">Push App</option>
            <option value="both">SMS + Push</option>
          </select>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            ENVOYER
          </button>
        </div>
      </div>
    </div>
  );
}