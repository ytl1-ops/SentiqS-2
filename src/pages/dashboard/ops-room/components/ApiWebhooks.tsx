import { useState } from 'react';
import { Webhook, Key, Globe, ArrowRightLeft } from 'lucide-react';

/**
 * Les onglets "Webhooks" et "Clés API" affichaient auparavant des
 * endpoints et des clés fabriqués, associés à de vrais noms d'entreprises
 * (risque réputationnel). Retirés tant qu'aucune table Supabase réelle de
 * gestion des intégrations n'existe. Le panneau "Documentation" reste
 * inchangé : ce sont des exemples génériques de référence API, pas des
 * identifiants réels.
 */
export default function ApiWebhooks() {
  const [activePanel, setActivePanel] = useState<'webhooks' | 'keys' | 'docs'>('webhooks');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-emerald-400" />
          API & Webhooks — Intégration PaaS
        </h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Gérez les clés d'intégration et les webhooks pour l'export des données vers vos systèmes
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-[#0f1a2e] rounded-lg p-1 border border-[#1a2d4a] w-fit">
        {[
          { id: 'webhooks', label: 'Webhooks', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
          { id: 'keys', label: 'Clés API', icon: <Key className="w-3.5 h-3.5" /> },
          { id: 'docs', label: 'Documentation', icon: <Globe className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActivePanel(tab.id as typeof activePanel)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activePanel === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2232]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content panels */}
      {activePanel === 'webhooks' && (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-10 text-center">
          <ArrowRightLeft className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun webhook configuré</p>
          <p className="text-[10px] text-gray-600 mt-1 max-w-sm mx-auto">
            La gestion des webhooks n'est pas encore connectée à une source de données réelle.
          </p>
        </div>
      )}

      {activePanel === 'keys' && (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-10 text-center">
          <Key className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune clé API générée</p>
          <p className="text-[10px] text-gray-600 mt-1 max-w-sm mx-auto">
            La gestion des clés API n'est pas encore connectée à une source de données réelle.
          </p>
        </div>
      )}

      {activePanel === 'docs' && (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">Documentation API SentiqS</h4>
          <div className="space-y-4">
            <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-4">
              <h5 className="text-xs font-bold text-emerald-400 mb-2">Endpoint : GET /v1/incidents</h5>
              <p className="text-[10px] text-gray-400 mb-3">Récupère la liste des incidents de sécurité par pays, région ou période.</p>
              <div className="bg-[#0d1520] rounded-md p-3 font-mono text-[10px] text-gray-300">
                <div><span className="text-emerald-400">GET</span> https://api.sentiqs.com/v1/incidents?country=CI&date_from=2026-08-01</div>
                <div className="text-gray-600 mt-1">Authorization: Bearer sk-sentiqs-xxxx</div>
              </div>
            </div>
            <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-4">
              <h5 className="text-xs font-bold text-emerald-400 mb-2">Endpoint : GET /v1/posture</h5>
              <p className="text-[10px] text-gray-400 mb-3">Récupère le niveau de posture (rouge/orange/jaune/vert) pour un ou plusieurs pays.</p>
              <div className="bg-[#0d1520] rounded-md p-3 font-mono text-[10px] text-gray-300">
                <div><span className="text-emerald-400">GET</span> https://api.sentiqs.com/v1/posture?countries=CI,ML,BF</div>
                <div className="text-gray-600 mt-1">Authorization: Bearer sk-sentiqs-xxxx</div>
              </div>
            </div>
            <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-4">
              <h5 className="text-xs font-bold text-emerald-400 mb-2">Webhooks entrants</h5>
              <p className="text-[10px] text-gray-400 mb-3">Pour alimenter SentiqS avec vos propres flux de données, utilisez l'endpoint d'ingestion.</p>
              <div className="bg-[#0d1520] rounded-md p-3 font-mono text-[10px] text-gray-300">
                <div><span className="text-amber-400">POST</span> https://api.sentiqs.com/v1/ingest</div>
                <div className="text-gray-600 mt-1">Content-Type: application/json</div>
                <div className="text-gray-600">X-API-Key: sk-sentiqs-xxxx</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}