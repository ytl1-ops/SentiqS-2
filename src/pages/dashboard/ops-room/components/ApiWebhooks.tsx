import { useState } from 'react';
import { Webhook, Key, Copy, Check, Globe, ArrowRightLeft, Clock, Pause, Play, Trash2, Plus } from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  type: string;
  status: string;
  url: string;
  lastTriggered: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  rateLimit: string;
  status: string;
}

interface ApiWebhooksProps {
  webhooks: WebhookEndpoint[];
  apiKeys: ApiKey[];
}

export default function ApiWebhooks({ webhooks, apiKeys }: ApiWebhooksProps) {
  const [activePanel, setActivePanel] = useState<'webhooks' | 'keys' | 'docs'>('webhooks');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500">{webhooks.length} endpoints configurés</p>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[10px] font-semibold hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Ajouter un webhook
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-[#0f1a2e] rounded-lg border border-[#1a2d4a] p-4 flex items-center gap-4 flex-wrap">
                <div className={`w-2 h-2 rounded-full ${
                  wh.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'
                } flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-100">{wh.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      wh.type === 'outgoing' ? 'bg-blue-900/20 text-blue-400' : 'bg-violet-900/20 text-violet-400'
                    }`}>
                      {wh.type === 'outgoing' ? 'Sortant' : 'Entrant'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      wh.status === 'active' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {wh.status === 'active' ? 'Actif' : 'En pause'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-1 truncate">{wh.url}</div>
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-600">
                    <Clock className="w-2.5 h-2.5" />
                    Dernier déclenchement : {new Date(wh.lastTriggered).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg bg-[#1a2232] border border-[#273449] flex items-center justify-center text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors cursor-pointer"
                  >
                    {wh.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg bg-[#1a2232] border border-[#273449] flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'keys' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500">{apiKeys.length} clés API actives</p>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[10px] font-semibold hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Générer une clé
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {apiKeys.map((k) => (
              <div key={k.id} className="bg-[#0f1a2e] rounded-lg border border-[#1a2d4a] p-4">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="text-sm font-bold text-gray-100">{k.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Créée le {k.created} · Limite : {k.rateLimit} · Dernière utilisation : {new Date(k.lastUsed).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-emerald-900/20 text-emerald-400 text-[9px] font-bold border border-emerald-800/30">
                    {k.status === 'active' ? 'ACTIVE' : 'DÉSACTIVÉE'}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#1a2232] rounded-lg p-3 border border-[#273449]">
                  <code className="flex-1 text-xs text-gray-300 font-mono truncate select-all">{k.key}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyKey(k.key)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#273449] text-gray-300 text-[10px] font-semibold hover:bg-[#334155] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedKey === k.key ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
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