import { useState } from 'react';
import { useScoreCalculations } from '@/hooks/useScoreCalculations';

const FACTOR_LABELS: Record<string, string> = {
  alert_score: 'Alertes structurées (analystes)',
  feed_score: 'Flux (pondérés fraîcheur + fiabilité source)',
  aggravants_total: 'Facteurs aggravants',
  volume_bonus: 'Volume de signalements',
  security_bonus: 'Concentration sécuritaire',
  sticky_floor: 'Plancher de persistance (7j)',
  distinct_sources: 'Sources distinctes comptabilisées',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  provisoire: { label: 'Provisoire — à valider', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  valide: { label: 'Validé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  conteste: { label: 'Contesté', className: 'bg-red-50 text-red-700 border-red-200' },
  expire: { label: 'Expiré', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const COVERAGE_LABELS: Record<string, { label: string; className: string }> = {
  bonne_couverture: { label: 'Bonne couverture', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  couverture_partielle: { label: 'Couverture partielle', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  donnees_anciennes: { label: 'Données anciennes', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  aucune_donnee_recente: { label: 'Aucune donnée récente', className: 'bg-gray-100 text-gray-600 border-gray-300' },
  source_indisponible: { label: 'Source indisponible', className: 'bg-red-50 text-red-700 border-red-200' },
  collecte_en_cours: { label: 'Collecte en cours', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

interface ScoreJustificationPanelProps {
  countryCode: string;
  coverage?: string;
  corroborationLimited?: boolean;
}

// NB: aucune détection de rôle admin côté client n'existe encore dans
// l'application (cf. AuthGuard.tsx) — les actions Valider/Contester sont
// donc affichées à tout utilisateur connecté, et c'est la policy RLS
// "admins manage score_calculations" (is_admin()) qui rejette réellement
// l'écriture pour un non-admin. Un masquage côté UI pourra être ajouté
// quand un hook de rôle existera, mais ne remplacerait jamais la RLS.
export default function ScoreJustificationPanel({ countryCode, coverage, corroborationLimited }: ScoreJustificationPanelProps) {
  const { calculation, evidenceFeeds, evidenceAlerts, loading, error, setStatus } = useScoreCalculations(countryCode);
  const [expanded, setExpanded] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const coverageInfo = coverage ? COVERAGE_LABELS[coverage] : null;

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <i className="ri-shield-check-line text-sentiqs-navy" />
          <h3 className="text-sm font-bold text-sentiqs-navy">Pourquoi ce niveau ?</h3>
          {coverageInfo && (
            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold border ${coverageInfo.className}`}>
              {coverageInfo.label}
            </span>
          )}
        </div>
        <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">
              <i className="ri-loader-4-line animate-spin mr-1.5" />
              Chargement de la justification…
            </div>
          ) : error ? (
            <div className="py-6 text-center text-xs text-red-500">Erreur : {error}</div>
          ) : !calculation ? (
            <div className="py-6 text-center text-xs text-gray-500 bg-gray-50 rounded-lg mt-3">
              <i className="ri-information-line mr-1.5" />
              Données justificatives insuffisantes
            </div>
          ) : (
            <div className="pt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className={`inline-block px-2 py-0.5 rounded font-semibold border ${STATUS_LABELS[calculation.status]?.className || ''}`}>
                  {STATUS_LABELS[calculation.status]?.label || calculation.status}
                </span>
                <span className="text-gray-400">
                  Règle {calculation.rule_version} · calculé le {new Date(calculation.computed_at).toLocaleString('fr-FR')}
                </span>
                {calculation.confidence != null && (
                  <span className="text-gray-400">· confiance {(calculation.confidence * 100).toFixed(0)}%</span>
                )}
              </div>

              {corroborationLimited && (
                <div className="text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded-lg px-3 py-2">
                  <i className="ri-alert-line mr-1.5" />
                  Niveau plafonné : le score justifierait un niveau critique, mais la corroboration multi-sources
                  est insuffisante pour l'afficher sans validation humaine.
                </div>
              )}

              {calculation.explanation && (
                <p className="text-xs text-gray-600 leading-relaxed">{calculation.explanation}</p>
              )}

              {Object.keys(calculation.factors || {}).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Facteurs</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(calculation.factors).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 rounded-md px-2.5 py-1.5">
                        <div className="text-xs font-bold text-sentiqs-navy">{value}</div>
                        <div className="text-[9px] text-gray-500">{FACTOR_LABELS[key] || key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(evidenceAlerts.length > 0 || evidenceFeeds.length > 0) && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Preuves utilisées ({evidenceAlerts.length + evidenceFeeds.length})
                  </div>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {evidenceAlerts.map((a) => (
                      <li key={`alert-${a.id}`} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <i className="ri-flag-2-line text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{a.title} <span className="text-gray-400">— {a.source}, {new Date(a.timestamp).toLocaleDateString('fr-FR')}</span></span>
                      </li>
                    ))}
                    {evidenceFeeds.map((f) => (
                      <li key={`feed-${f.id}`} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <i className="ri-newspaper-line text-sentiqs-navy mt-0.5 flex-shrink-0" />
                        {f.source_url ? (
                          <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {f.title} <span className="text-gray-400">— {f.source}, {new Date(f.timestamp).toLocaleDateString('fr-FR')}</span>
                          </a>
                        ) : (
                          <span>{f.title} <span className="text-gray-400">— {f.source}, {new Date(f.timestamp).toLocaleDateString('fr-FR')}</span></span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {calculation.status === 'provisoire' && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await setStatus('valide');
                      setActionMessage(res.message);
                    }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Valider ce niveau
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await setStatus('conteste');
                      setActionMessage(res.message);
                    }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Contester
                  </button>
                  {actionMessage && <span className="text-[10px] text-gray-400">{actionMessage}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
