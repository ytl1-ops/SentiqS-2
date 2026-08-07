import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================================
// SentiqS — PurgeSyntheticPanel
// Bouton protégé pour auditer et supprimer les feeds synthétiques.
// ============================================================

interface AuditReport {
  mode: 'audit';
  audited_at: string;
  total: number;
  nb_synthetic: number;
  nb_real: number;
  synthetic_ids: string[];
  real_ids: string[];
}

interface DeleteReport {
  mode: 'delete';
  executed_at: string;
  synthetic_before: number;
  deleted: number;
  deleted_ids: string[];
  errors: string[];
}

type Phase = 'idle' | 'auditing' | 'audit-done' | 'deleting' | 'delete-done' | 'error';

export default function PurgeSyntheticPanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [deleteReport, setDeleteReport] = useState<DeleteReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showModal, setShowModal] = useState(false);

  const CONFIRM_PHRASE = 'JE_CONFIRME_LA_SUPPRESSION';

  const isConfirmValid = confirmText === CONFIRM_PHRASE;

  const runAudit = useCallback(async () => {
    setPhase('auditing');
    setErrorMsg(null);
    setAuditReport(null);
    setDeleteReport(null);
    setShowModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('purge-synthetic-feeds', {
        body: { mode: 'audit' },
      });

      if (error) throw error;
      if (!data?.success || !data?.report) {
        throw new Error(data?.error || 'Réponse inattendue du serveur.');
      }

      setAuditReport(data.report as AuditReport);
      setPhase('audit-done');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Erreur inconnue.');
      setPhase('error');
    }
  }, []);

  const runDelete = useCallback(async () => {
    if (!isConfirmValid) return;

    setPhase('deleting');
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke('purge-synthetic-feeds', {
        body: { mode: 'delete', confirm: CONFIRM_PHRASE },
      });

      if (error) throw error;
      if (!data?.success || !data?.report) {
        throw new Error(data?.error || 'Réponse inattendue du serveur.');
      }

      setDeleteReport(data.report as DeleteReport);
      setPhase('delete-done');
      setConfirmText('');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Erreur inconnue lors de la suppression.');
      setPhase('error');
    }
  }, [isConfirmValid]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setPhase('idle');
    setAuditReport(null);
    setDeleteReport(null);
    setErrorMsg(null);
    setConfirmText('');
  }, []);

  return (
    <>
      {/* Panel card */}
      <div className="bg-white rounded-lg border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-sentiqs-navy mb-1">
              Purge des flux synthétiques
            </h3>
            <p className="text-[10px] text-sentiqs-gray-text leading-relaxed max-w-lg">
              Cette opération identifie les feeds générés artificiellement (IDs fabriqués)
              et permet de les supprimer définitivement de la base.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                <i className="ri-shield-flash-line text-xs" />
                Action protégée
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-full font-medium">
                <i className="ri-delete-bin-line text-xs" />
                Irréversible
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={runAudit}
            disabled={phase === 'auditing' || phase === 'deleting'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <i className={`${phase === 'auditing' || phase === 'deleting' ? 'ri-loader-4-line animate-spin' : 'ri-delete-bin-line'} text-xs`} />
            Purger les flux synthétiques
          </button>
        </div>

        {/* Quick stat row when we have audit data but modal is closed */}
        {auditReport && !showModal && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] text-sentiqs-gray-text">
              Dernier audit : {new Date(auditReport.audited_at).toLocaleString('fr-FR')}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] font-medium text-sentiqs-navy">
                {auditReport.total} feeds au total
              </span>
              <span className="text-[10px] font-medium text-red-600">
                {auditReport.nb_synthetic} synthétiques
              </span>
              <span className="text-[10px] font-medium text-emerald-600">
                {auditReport.nb_real} réels
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <i className="ri-delete-bin-line text-red-600 text-sm w-4 h-4 flex items-center justify-center" />
                </div>
                <h3 className="text-sm font-bold text-sentiqs-navy">
                  Purge des flux synthétiques
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-gray-400 text-sm w-4 h-4 flex items-center justify-center" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Loading spinner */}
              {(phase === 'auditing' || phase === 'deleting') && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-10 h-10 rounded-full border-2 border-red-200 border-t-red-600 animate-spin" />
                  <p className="text-xs text-sentiqs-gray-text">
                    {phase === 'auditing' ? 'Audit en cours... Analyse des feeds.' : 'Suppression en cours... Ne fermez pas cette fenêtre.'}
                  </p>
                </div>
              )}

              {/* Error state */}
              {phase === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <i className="ri-error-warning-line text-red-500 text-sm mt-0.5 w-4 h-4 flex items-center justify-center" />
                    <div>
                      <p className="text-xs font-semibold text-red-700">Erreur</p>
                      <p className="text-[10px] text-red-600 mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('idle');
                      setErrorMsg(null);
                    }}
                    className="mt-3 text-[10px] font-semibold text-red-700 hover:text-red-800 cursor-pointer"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {/* Audit results */}
              {phase === 'audit-done' && auditReport && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-sentiqs-navy">{auditReport.total}</p>
                      <p className="text-[10px] text-sentiqs-gray-text">Total</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-600">{auditReport.nb_synthetic}</p>
                      <p className="text-[10px] text-red-500">Synthétiques</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-600">{auditReport.nb_real}</p>
                      <p className="text-[10px] text-emerald-500">Réels</p>
                    </div>
                  </div>

                  {auditReport.synthetic_ids.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-sentiqs-navy mb-1.5">
                        IDs synthétiques détectés ({auditReport.synthetic_ids.length})
                      </p>
                      <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {auditReport.synthetic_ids.slice(0, 50).map((id) => (
                            <span
                              key={id}
                              className="inline-block text-[10px] text-red-700 bg-red-100 px-1.5 py-0.5 rounded font-mono"
                            >
                              {id}
                            </span>
                          ))}
                          {auditReport.synthetic_ids.length > 50 && (
                            <span className="text-[10px] text-red-500">
                              + {auditReport.synthetic_ids.length - 50} autres
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {auditReport.nb_synthetic > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <i className="ri-alert-line text-amber-600 text-sm mt-0.5 w-4 h-4 flex items-center justify-center" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Confirmation requise</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">
                            {auditReport.nb_synthetic} feeds synthétiques seront supprimés définitivement.
                            Les {auditReport.nb_real} feeds réels ne seront pas affectés.
                            Pour continuer, tapez exactement : <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">{CONFIRM_PHRASE}</code>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.currentTarget.value)}
                          placeholder={CONFIRM_PHRASE}
                          className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white font-mono"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={runDelete}
                        disabled={!isConfirmValid}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <i className="ri-delete-bin-line text-xs w-4 h-4 flex items-center justify-center" />
                        Supprimer définitivement {auditReport.nb_synthetic} feeds synthétiques
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <i className="ri-checkbox-circle-line text-emerald-600 text-sm mt-0.5 w-4 h-4 flex items-center justify-center" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-800">Aucun feed synthétique</p>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Les {auditReport.total} feeds de la base sont tous réels. Aucune action nécessaire.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Delete results */}
              {phase === 'delete-done' && deleteReport && (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-emerald-600 text-sm mt-0.5 w-4 h-4 flex items-center justify-center" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-800">Purge terminée</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          {deleteReport.deleted} feeds synthétiques supprimés sur {deleteReport.synthetic_before} détectés.
                        </p>
                        {deleteReport.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-semibold text-red-600">
                              {deleteReport.errors.length} erreur(s) lors de la suppression :
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {deleteReport.errors.map((e, i) => (
                                <li key={i} className="text-[10px] text-red-500">{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-[11px] font-semibold text-sentiqs-gray-text hover:text-sentiqs-navy hover:bg-gray-100 transition-colors whitespace-nowrap cursor-pointer"
              >
                {phase === 'delete-done' ? 'Fermer' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}