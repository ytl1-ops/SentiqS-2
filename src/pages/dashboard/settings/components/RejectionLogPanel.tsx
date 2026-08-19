import { useMemo, useState } from 'react';
import { useFeedRejectionLogs, type FeedRejectionLog } from '@/hooks/useFeedRejectionLogs';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const REASON_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  TITLE_TOO_SHORT: { label: 'Titre trop court', color: 'bg-red-50 text-red-700 border-red-200', icon: 'ri-text-spacing' },
  TITLE_IS_SOURCE_NAME: { label: 'Titre = nom de source', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'ri-user-voice-line' },
  MISSING_SOURCE_URL: { label: 'URL source manquante', color: 'bg-red-50 text-red-700 border-red-200', icon: 'ri-link-unlink' },
  COUNTRY_REQUIRED: { label: 'Pays requis absent', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ri-map-pin-line' },
  INVALID_CATEGORY: { label: 'Catégorie invalide', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ri-price-tag-3-line' },
};

const REASON_DESCRIPTIONS: Record<string, string> = {
  TITLE_TOO_SHORT: 'Le titre soumis est vide ou fait moins de 10 caractères. Un titre d\'actualité crédible doit être suffisamment descriptif.',
  TITLE_IS_SOURCE_NAME: 'Le titre est identique au nom de la source médiatique. Ce n\'est pas un titre d\'article mais probablement une donnée de test.',
  MISSING_SOURCE_URL: 'Aucune URL source fournie. Chaque flux doit pointer vers un article ou un flux RSS vérifiable.',
  COUNTRY_REQUIRED: 'Le champ pays est vide. Chaque flux doit être associé à un pays africain pour le suivi géographique.',
  INVALID_CATEGORY: 'La catégorie ne fait pas partie des 12 catégories valides (Sécurité, Politique, Économie, Santé, Environnement, Social, Cyber, Diplomatie, Énergie, Transport, Humanitaire, Militaire).',
};

export default function RejectionLogPanel() {
  const { logs, loading, error, refetch } = useFeedRejectionLogs(100);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCode, setFilterCode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filterCode) return logs;
    return logs.filter((l) => l.reason_code === filterCode);
  }, [logs, filterCode]);

  const reasonBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    logs.forEach((l) => {
      breakdown[l.reason_code] = (breakdown[l.reason_code] || 0) + 1;
    });
    return breakdown;
  }, [logs]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground-950">Journal des rejets — Trigger DB</h2>
          <p className="text-[10px] text-foreground-600 mt-0.5">
            Chaque insertion rejetée par le trigger <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[9px] font-mono">validate_feed_on_insert</code> est enregistrée ici avec le motif détaillé du rejet.
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary-500 text-background-50 text-xs font-semibold hover:bg-secondary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`ri-refresh-line text-xs ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Summary cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.keys(REASON_LABELS).map((code) => {
            const count = reasonBreakdown[code] || 0;
            if (count === 0) return null;
            const info = REASON_LABELS[code];
            return (
              <button
                key={code}
                type="button"
                onClick={() => setFilterCode(filterCode === code ? null : code)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  filterCode === code
                    ? `${info.color} ring-1 ring-offset-1`
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <i className={`${info.icon} text-[11px] ${filterCode === code ? '' : 'text-foreground-600'}`} />
                  <span className="text-[9px] font-semibold text-foreground-600">{info.label}</span>
                </div>
                <div className="text-lg font-bold text-foreground-950">{count}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
          <i className="ri-error-warning-line mr-1.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 py-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
            <i className="ri-shield-check-line text-emerald-600 text-xl" />
          </div>
          <div className="text-sm font-semibold text-foreground-950 mb-1">Aucun rejet enregistré</div>
          <p className="text-[11px] text-foreground-600 max-w-md mx-auto">
            Le trigger DB n&apos;a encore rejeté aucune insertion suspecte. Toutes les tentatives d&apos;insertion dans la table <code className="bg-gray-100 px-1 py-0.5 rounded text-[9px] font-mono">feeds</code> étaient valides.
          </p>
        </div>
      )}

      {/* Logs list */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
          {filtered.map((log) => {
            const info = REASON_LABELS[log.reason_code] || { label: log.reason_code, color: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'ri-question-line' };
            const desc = REASON_DESCRIPTIONS[log.reason_code] || 'Raison inconnue.';
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full px-5 py-3 flex items-start gap-3 text-left cursor-pointer"
                >
                  {/* Icon + reason badge */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${info.color.split(' ')[0]}`}>
                      <i className={`${info.icon} text-sm ${info.color.split(' ')[1] || 'text-gray-500'}`} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${info.color}`}>
                        {info.label}
                      </span>
                      <span className="text-[9px] font-mono text-foreground-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        {log.reason_code}
                      </span>
                      <span className="text-[9px] text-foreground-600">
                        {formatDate(log.rejected_at)}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-foreground-950 truncate">
                      {log.title || <span className="italic text-foreground-600">(titre absent)</span>}
                    </div>

                    {/* Details row */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-[9px] text-foreground-600">
                      {log.source && <span>{log.source}</span>}
                      {log.country && <span className="uppercase">{log.country}</span>}
                      {log.category && <span>{log.category}</span>}
                      {log.source_url && (
                        <span className="font-mono text-[8px] truncate max-w-[200px]">{log.source_url}</span>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <div>
                          <div className="text-[9px] font-semibold text-foreground-600 uppercase mb-1">Motif du rejet</div>
                          <p className="text-[10px] text-foreground-600 leading-relaxed">{desc}</p>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold text-foreground-600 uppercase mb-1">Détail technique</div>
                          <p className="text-[10px] text-red-700 bg-red-50 rounded px-2 py-1.5 font-mono text-[9px] break-all">
                            {log.reason_detail}
                          </p>
                        </div>
                        {log.raw_data && (
                          <div>
                            <div className="text-[9px] font-semibold text-foreground-600 uppercase mb-1">Données brutes soumises</div>
                            <pre className="text-[8px] text-foreground-600 bg-gray-50 rounded px-2 py-1.5 overflow-x-auto max-h-32 font-mono">
                              {JSON.stringify(log.raw_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <div className="flex-shrink-0 mt-1">
                    {isExpanded ? (
                      <i className="ri-arrow-up-s-line text-foreground-600 text-sm" />
                    ) : (
                      <i className="ri-arrow-down-s-line text-foreground-600 text-sm" />
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      {!loading && logs.length > 0 && (
        <div className="bg-secondary-50/60 border border-secondary-200/60 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line text-secondary-700 text-sm" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-secondary-800 mb-0.5">Fonctionnement du trigger</div>
              <p className="text-[10px] text-secondary-700 leading-relaxed">
                Le trigger <code className="bg-secondary-100 px-1 py-0.5 rounded text-[9px] font-mono">validate_feed_on_insert</code> s&apos;exécute <strong>avant chaque insertion</strong> dans la table <code className="bg-secondary-100 px-1 py-0.5 rounded text-[9px] font-mono">feeds</code>. Si les données ne passent pas les 5 validations (titre, source, URL, pays, catégorie), l&apos;insertion est annulée et ce journal est créé. Même le <code className="bg-secondary-100 px-1 py-0.5 rounded text-[9px] font-mono">service_role</code> est soumis à ces vérifications. La seule voie d&apos;insertion valide est l&apos;edge function <code className="bg-secondary-100 px-1 py-0.5 rounded text-[9px] font-mono">ingest-feed</code>, qui effectue ses propres vérifications en amont.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}