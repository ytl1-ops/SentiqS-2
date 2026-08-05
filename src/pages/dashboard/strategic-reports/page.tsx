import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { StrategicReport, StrategicReportType, ExportFormat, SIRPayload, SITREPPayload, ThreatAssessmentPayload, LogisticsAuditPayload } from '@/types/strategic';
import Toast from '@/components/base/Toast';
import ShareRouterModal from './components/ShareRouterModal';

const REPORT_TABS: { key: StrategicReportType; icon: string; label: string }[] = [
  { key: 'sir', icon: 'ri-flashlight-line', label: 'Alerte Flash (SIR)' },
  { key: 'sitrep', icon: 'ri-file-list-3-line', label: 'Point Quotidien (SITREP)' },
  { key: 'threat_assessment', icon: 'ri-radar-line', label: 'Évaluation Menaces' },
  { key: 'logistics_audit', icon: 'ri-truck-line', label: 'Audit Logistique' },
];

const EXPORT_FORMATS: { key: ExportFormat; icon: string; label: string; color: string }[] = [
  { key: 'pdf', icon: 'ri-file-pdf-2-line', label: 'PDF', color: 'text-red-500' },
  { key: 'word', icon: 'ri-file-word-2-line', label: 'Word', color: 'text-blue-500' },
  { key: 'excel', icon: 'ri-file-excel-2-line', label: 'Excel', color: 'text-emerald-600' },
  { key: 'ppt', icon: 'ri-file-ppt-2-line', label: 'PowerPoint', color: 'text-orange-500' },
  { key: 'csv', icon: 'ri-file-text-line', label: 'CSV', color: 'text-gray-500' },
  { key: 'image', icon: 'ri-image-line', label: 'Image', color: 'text-violet-500' },
];

export default function StrategicReportsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StrategicReportType>('sir');
  const [reports, setReports] = useState<StrategicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Share Router state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [shareDocTitle, setShareDocTitle] = useState<string | null>(null);

  // Form states per tab
  const [sirForm, setSirForm] = useState<SIRPayload>({ incident_nature: '', gps_lat: null, gps_lng: null, severity: 'medium', instructions: '', affected_area: '', casualties: null, response_status: '' });
  const [sitrepForm, setSitrepForm] = useState<SITREPPayload>({ bilan_24h: '', road_axes: [], airports: [], weather: { conditions: '', temperature: null, updated_at: '' }, key_incidents: [], recommendations: '' });
  const [threatForm, setThreatForm] = useState<ThreatAssessmentPayload>({ political_risk: { level: '', summary: '', triggers: [] }, health_risk: { level: '', summary: '', active_outbreaks: [] }, security_risk: { level: '', summary: '', active_groups: [] }, actor_mapping: [], forecast_30d: '' });
  const [auditForm, setAuditForm] = useState<LogisticsAuditPayload>({ base_security: { perimeter: '', access_control: '', emergency_exits: '', score: 0 }, route_checkpoints: [], site_safety: { fire_protection: '', medical_capability: '', comms_redundancy: '' }, supply_chain: { fuel_status: '', water_status: '', food_stock_days: 0 }, recommendations: [] });
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>(['pdf', 'word']);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('strategic_reports').select('*').order('created_at', { ascending: false });
      setReports((data || []) as StrategicReport[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const toggleFormat = (fmt: ExportFormat) => {
    setSelectedFormats((prev) => prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]);
  };

  const handleGenerate = async () => {
    if (selectedFormats.length === 0) { setToast('Sélectionnez au moins un format d\'export'); return; }
    setGenerating(true);
    try {
      let payload: Record<string, unknown>;
      if (activeTab === 'sir') payload = sirForm as unknown as Record<string, unknown>;
      else if (activeTab === 'sitrep') payload = sitrepForm as unknown as Record<string, unknown>;
      else if (activeTab === 'threat_assessment') payload = threatForm as unknown as Record<string, unknown>;
      else payload = auditForm as unknown as Record<string, unknown>;

      const tabLabel = REPORT_TABS.find((t) => t.key === activeTab)?.label || activeTab;
      await supabase.from('strategic_reports').insert({
        report_type: activeTab,
        title: `${tabLabel} — ${new Date().toLocaleDateString('fr-FR')}`,
        status: 'ready',
        payload,
        generated_formats: selectedFormats,
        generated_at: new Date().toISOString(),
      });

      setToast('Rapport généré avec succès');
      fetchReports();
      // Reset form
      if (activeTab === 'sir') setSirForm({ incident_nature: '', gps_lat: null, gps_lng: null, severity: 'medium', instructions: '', affected_area: '', casualties: null, response_status: '' });
    } catch {
      setToast('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const filteredReports = reports.filter((r) => r.report_type === activeTab);

  const handleShare = (docId: number, docTitle: string) => {
    setShareDocId(String(docId));
    setShareDocTitle(docTitle);
    setShareOpen(true);
  };

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      <ShareRouterModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); setShareDocId(null); setShareDocTitle(null); }}
        documentType="strategic_report"
        documentId={shareDocId}
        documentTitle={shareDocTitle}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">Rapports Stratégiques</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">Génération et export des 4 niveaux de rapports — SIR, SITREP, Menaces, Audit Logistique</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.key ? 'bg-white text-sentiqs-navy shadow-sm' : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
            }`}
          >
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report form + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form panel */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-sentiqs-navy mb-4 flex items-center gap-2">
            <i className={`${REPORT_TABS.find((t) => t.key === activeTab)?.icon} text-base`} />
            {REPORT_TABS.find((t) => t.key === activeTab)?.label}
          </h2>

          {/* ─── SIR Form ─── */}
          {activeTab === 'sir' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Nature de l'incident</label>
                <input type="text" value={sirForm.incident_nature} onChange={(e) => setSirForm({ ...sirForm, incident_nature: e.target.value })} placeholder="Ex: Attaque armée, Manifestation violente..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">GPS Latitude</label>
                  <input type="number" step="any" value={sirForm.gps_lat ?? ''} onChange={(e) => setSirForm({ ...sirForm, gps_lat: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: 5.3364" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">GPS Longitude</label>
                  <input type="number" step="any" value={sirForm.gps_lng ?? ''} onChange={(e) => setSirForm({ ...sirForm, gps_lng: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: -4.0083" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Sévérité</label>
                  <select value={sirForm.severity} onChange={(e) => setSirForm({ ...sirForm, severity: e.target.value as SIRPayload['severity'] })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white">
                    <option value="critical">Critique</option>
                    <option value="high">Élevée</option>
                    <option value="medium">Moyenne</option>
                    <option value="low">Faible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Zone affectée</label>
                  <input type="text" value={sirForm.affected_area} onChange={(e) => setSirForm({ ...sirForm, affected_area: e.target.value })} placeholder="Ex: Quartier, ville..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Consignes</label>
                <textarea value={sirForm.instructions} onChange={(e) => setSirForm({ ...sirForm, instructions: e.target.value })} rows={3} maxLength={500} placeholder="Consignes de sécurité immédiates..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
              </div>
            </div>
          )}

          {/* ─── SITREP Form ─── */}
          {activeTab === 'sitrep' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Bilan 24h</label>
                <textarea value={sitrepForm.bilan_24h} onChange={(e) => setSitrepForm({ ...sitrepForm, bilan_24h: e.target.value })} rows={3} maxLength={1000} placeholder="Synthèse des dernières 24h..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Conditions météo</label>
                  <input type="text" value={sitrepForm.weather.conditions} onChange={(e) => setSitrepForm({ ...sitrepForm, weather: { ...sitrepForm.weather, conditions: e.target.value } })} placeholder="Ex: Orages, pluies diluviennes..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Température (°C)</label>
                  <input type="number" value={sitrepForm.weather.temperature ?? ''} onChange={(e) => setSitrepForm({ ...sitrepForm, weather: { ...sitrepForm.weather, temperature: e.target.value ? parseFloat(e.target.value) : null } })} placeholder="Ex: 32" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Recommandations</label>
                <textarea value={sitrepForm.recommendations} onChange={(e) => setSitrepForm({ ...sitrepForm, recommendations: e.target.value })} rows={2} maxLength={500} placeholder="Recommandations opérationnelles..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
              </div>
              {/* Road axes */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Axes routiers</label>
                {sitrepForm.road_axes.map((axis, i) => (
                  <div key={i} className="flex gap-2 mb-1.5">
                    <input type="text" value={axis.name} onChange={(e) => { const arr = [...sitrepForm.road_axes]; arr[i] = { ...arr[i], name: e.target.value }; setSitrepForm({ ...sitrepForm, road_axes: arr }); }} placeholder="Nom axe" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                    <select value={axis.status} onChange={(e) => { const arr = [...sitrepForm.road_axes]; arr[i] = { ...arr[i], status: e.target.value as 'open' | 'degraded' | 'closed' }; setSitrepForm({ ...sitrepForm, road_axes: arr }); }} className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                      <option value="open">Ouvert</option>
                      <option value="degraded">Dégradé</option>
                      <option value="closed">Fermé</option>
                    </select>
                    <button type="button" onClick={() => setSitrepForm({ ...sitrepForm, road_axes: sitrepForm.road_axes.filter((_, j) => j !== i) })} className="w-7 h-7 flex items-center justify-center rounded text-red-400 hover:bg-red-50"><i className="ri-close-line" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setSitrepForm({ ...sitrepForm, road_axes: [...sitrepForm.road_axes, { name: '', status: 'open', details: '' }] })} className="text-[10px] font-semibold text-sentiqs-navy/60 hover:text-sentiqs-navy flex items-center gap-1 mt-1">
                  <i className="ri-add-line text-xs" /> Ajouter un axe
                </button>
              </div>
            </div>
          )}

          {/* ─── Threat Assessment Form ─── */}
          {activeTab === 'threat_assessment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {(['political_risk', 'health_risk', 'security_risk'] as const).map((riskKey) => (
                  <div key={riskKey}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">
                      {riskKey === 'political_risk' ? 'Risque Politique' : riskKey === 'health_risk' ? 'Risque Sanitaire' : 'Risque Sécuritaire'}
                    </label>
                    <select value={threatForm[riskKey].level} onChange={(e) => setThreatForm({ ...threatForm, [riskKey]: { ...threatForm[riskKey], level: e.target.value } })} className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy bg-white mb-1.5">
                      <option value="">—</option>
                      <option value="critical">Critique</option>
                      <option value="high">Élevé</option>
                      <option value="medium">Moyen</option>
                      <option value="low">Faible</option>
                    </select>
                    <textarea value={threatForm[riskKey].summary} onChange={(e) => setThreatForm({ ...threatForm, [riskKey]: { ...threatForm[riskKey], summary: e.target.value } })} rows={2} placeholder="Résumé..." className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Prévision 30 jours</label>
                <textarea value={threatForm.forecast_30d} onChange={(e) => setThreatForm({ ...threatForm, forecast_30d: e.target.value })} rows={2} maxLength={500} placeholder="Tendances et prévisions..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
              </div>
            </div>
          )}

          {/* ─── Logistics Audit Form ─── */}
          {activeTab === 'logistics_audit' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Score base vie (0-10)</label>
                  <input type="number" min={0} max={10} value={auditForm.base_security.score} onChange={(e) => setAuditForm({ ...auditForm, base_security: { ...auditForm.base_security, score: parseInt(e.target.value, 10) || 0 } })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Stock alimentaire (jours)</label>
                  <input type="number" min={0} value={auditForm.supply_chain.food_stock_days} onChange={(e) => setAuditForm({ ...auditForm, supply_chain: { ...auditForm.supply_chain, food_stock_days: parseInt(e.target.value, 10) || 0 } })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Statut carburant</label>
                  <input type="text" value={auditForm.supply_chain.fuel_status} onChange={(e) => setAuditForm({ ...auditForm, supply_chain: { ...auditForm.supply_chain, fuel_status: e.target.value } })} placeholder="Ex: Réserve 15 jours" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Statut eau</label>
                  <input type="text" value={auditForm.supply_chain.water_status} onChange={(e) => setAuditForm({ ...auditForm, supply_chain: { ...auditForm.supply_chain, water_status: e.target.value } })} placeholder="Ex: Cuves pleines" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Protection incendie</label>
                  <input type="text" value={auditForm.site_safety.fire_protection} onChange={(e) => setAuditForm({ ...auditForm, site_safety: { ...auditForm.site_safety, fire_protection: e.target.value } })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Capacité médicale</label>
                  <input type="text" value={auditForm.site_safety.medical_capability} onChange={(e) => setAuditForm({ ...auditForm, site_safety: { ...auditForm.site_safety, medical_capability: e.target.value } })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Redondance comms</label>
                  <input type="text" value={auditForm.site_safety.comms_redundancy} onChange={(e) => setAuditForm({ ...auditForm, site_safety: { ...auditForm.site_safety, comms_redundancy: e.target.value } })} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>
            </div>
          )}

          {/* Export formats + Generate */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-2">Formats d'export cibles</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.key}
                  type="button"
                  onClick={() => toggleFormat(fmt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                    selectedFormats.includes(fmt.key)
                      ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                      : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-sentiqs-navy/30'
                  }`}
                >
                  <i className={`${fmt.icon} ${selectedFormats.includes(fmt.key) ? '' : fmt.color}`} />
                  {fmt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || selectedFormats.length === 0}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              {generating ? (
                <><i className="ri-loader-4-line animate-spin" /> Génération...</>
              ) : (
                <><i className="ri-file-chart-line" /> Générer le rapport</>
              )}
            </button>
          </div>
        </div>

        {/* Reports list panel */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h3 className="text-xs font-bold text-sentiqs-navy uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="ri-history-line" />
            Rapports générés ({filteredReports.length})
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredReports.length === 0 ? (
            <p className="text-[10px] text-sentiqs-gray-text py-8 text-center">Aucun rapport de ce type. Utilisez le formulaire pour générer votre premier rapport.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredReports.map((rpt) => (
                <div key={rpt.id} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                  <p className="text-[11px] font-semibold text-sentiqs-navy line-clamp-2">{rpt.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-sentiqs-gray-text">
                    <span>{formatDate(rpt.created_at)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${rpt.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {rpt.status === 'ready' ? 'Prêt' : rpt.status}
                    </span>
                  </div>
                  {(rpt.generated_formats as string[] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(rpt.generated_formats as string[]).map((fmt: string) => {
                        const f = EXPORT_FORMATS.find((ef) => ef.key === fmt);
                        return (
                          <span key={fmt} className={`text-[9px] font-semibold flex items-center gap-0.5 ${f?.color || 'text-gray-500'}`}>
                            <i className={`${f?.icon || 'ri-file-line'} text-[10px]`} />{f?.label || fmt}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button type="button" onClick={() => handleShare(rpt.id, rpt.title)} className="w-7 h-7 flex items-center justify-center rounded bg-gray-50 text-sentiqs-gray-text hover:bg-sentiqs-navy/10 hover:text-sentiqs-navy transition-colors cursor-pointer" title="Partager">
                      <i className="ri-share-forward-line text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}