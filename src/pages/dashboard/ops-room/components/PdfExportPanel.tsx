import { useState } from 'react';
import { FileText, Download, MapPin, Shield, AlertTriangle, FileCheck } from 'lucide-react';
import { ALL_AFRICA_COUNTRIES, type AfricaCountry } from '@/data/africaRegions';

interface PdfExportPanelProps {
  selectedCountry: AfricaCountry | null;
}

const reportTypes = [
  { id: 'securite', label: 'Fiche Sûreté Pré-déplacement', icon: <Shield className="w-4 h-4" />, desc: 'Évaluation sécuritaire complète pour une région ou localité' },
  { id: 'situation', label: 'Rapport de Situation Pays', icon: <FileText className="w-4 h-4" />, desc: 'Synthèse des incidents et niveau de risque par pays' },
  { id: 'alerte', label: 'Bulletin d\'Alerte Flash', icon: <AlertTriangle className="w-4 h-4" />, desc: 'Alerte urgente sur un incident en cours' },
  { id: 'mensuel', label: 'Rapport Mensuel Régional', icon: <FileCheck className="w-4 h-4" />, desc: 'Compilation mensuelle par région africaine' },
];

export default function PdfExportPanel({ selectedCountry }: PdfExportPanelProps) {
  const [reportType, setReportType] = useState('securite');
  const [targetCountry, setTargetCountry] = useState(selectedCountry?.code || '');
  const [targetLocality, setTargetLocality] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 4000);
    }, 2000);
  };

  const selectedReport = reportTypes.find((r) => r.id === reportType);
  const countryObj = ALL_AFRICA_COUNTRIES.find((c) => c.code === targetCountry);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Export Rapport PDF — Fiche de Sûreté
        </h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Génération automatique de rapports de synthèse par pays, région ou localité
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Configuration panel */}
        <div className="lg:col-span-1 bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">Paramètres du rapport</h4>

          {/* Report type */}
          <div className="mb-4">
            <label className="block text-[10px] font-semibold text-gray-500 mb-2">TYPE DE RAPPORT</label>
            <div className="space-y-1.5">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setReportType(rt.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                    reportType === rt.id
                      ? 'bg-emerald-900/20 border border-emerald-800/40 text-emerald-400'
                      : 'bg-[#1a2232] border border-[#273449] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="flex-shrink-0">{rt.icon}</span>
                  <div>
                    <div className="text-xs font-semibold">{rt.label}</div>
                    <div className="text-[9px] opacity-70">{rt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Country selector */}
          <div className="mb-4">
            <label className="block text-[10px] font-semibold text-gray-500 mb-2">PAYS CIBLE</label>
            <select
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              className="w-full bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Sélectionner un pays...</option>
              {ALL_AFRICA_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Locality */}
          <div className="mb-4">
            <label className="block text-[10px] font-semibold text-gray-500 mb-2">
              LOCALITÉ / RÉGION <span className="text-gray-700">(optionnel)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                value={targetLocality}
                onChange={(e) => setTargetLocality(e.target.value)}
                placeholder="Ex: Facobly, Guémon, RN1..."
                className="w-full bg-[#1a2232] border border-[#273449] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!targetCountry || generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Génération en cours...
              </>
            ) : generated ? (
              <>
                <FileCheck className="w-4 h-4" />
                Rapport généré !
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                GÉNÉRER LE PDF
              </>
            )}
          </button>

          {generated && (
            <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-emerald-400">Rapport prêt</div>
                  <div className="text-[10px] text-emerald-600">
                    {countryObj?.name || targetCountry}{targetLocality ? ` — ${targetLocality}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger le PDF
              </button>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2 bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">Aperçu du rapport</h4>

          {!targetCountry ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sélectionnez un pays pour prévisualiser le rapport</p>
              <p className="text-[10px] text-gray-600 mt-1">Le rapport inclura les incidents récents, l'évaluation des risques et les recommandations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Report header preview */}
              <div className="bg-[#1a2232] rounded-lg border border-[#273449] p-5">
                <div className="border-b border-[#273449] pb-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">SENTIQS — RENSEIGNEMENT SÛRETÉ</div>
                      <div className="text-base font-bold text-gray-100">
                        {selectedReport?.label} — {countryObj?.name || targetCountry}
                      </div>
                      {targetLocality && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Zone : {targetLocality}, {countryObj?.name}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">Classification</div>
                      <div className="text-xs font-bold text-amber-400">CONFIDENTIEL — USAGE INTERNE</div>
                    </div>
                  </div>
                </div>

                {/* Sample content */}
                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-bold text-gray-300 mb-2">1. NIVEAU DE RISQUE</h5>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-orange-900/20 text-orange-400 border border-orange-800/40 text-xs font-bold">
                        ÉLEVÉ — SCORE 72/100
                      </span>
                      <span className="text-[10px] text-gray-500">Basé sur 8 incidents / 30 jours</span>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-gray-300 mb-2">2. INCIDENTS RÉCENTS</h5>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-400">
                          Attaque armée signalée — Source: <span className="text-emerald-500">AIP (Agence Ivoirienne de Presse)</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-400">
                          Fermeture RN1 travaux — Source: <span className="text-emerald-500">Ministère des Infrastructures</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-400">
                          Tensions communautaires — Source: <span className="text-emerald-500">KOACI.com</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-gray-300 mb-2">3. RECOMMANDATIONS</h5>
                    <ul className="space-y-1.5 text-[10px] text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        Suspension des déplacements non essentiels dans la zone
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        Vérification des itinéraires alternatifs (déviation RN1 active)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        Contact consulaire recommandé pour les ressortissants
                      </li>
                    </ul>
                  </div>

                  <div className="text-[9px] text-gray-600 pt-4 border-t border-[#273449]">
                    Rapport généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' '}à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' '}— Sources : ACLED, ReliefWeb, AIP, Ministère Infrastructures, KOACI
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}