import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { OrgBranding, OrgBrandingTemplateVars } from '@/types/strategic';
import Toast from '@/components/base/Toast';

const DEFAULT_TEMPLATE_VARS: OrgBrandingTemplateVars = {
  ORG_NAME: '',
  ORG_SHORT_NAME: '',
  ORG_LOGO_URL: '',
  ORG_COLOR_PRIMARY: '#1a1a2e',
  ORG_COLOR_SECONDARY: '#e94560',
  ORG_FONT_HEADING: 'Inter',
  ORG_FONT_BODY: 'Inter',
  ORG_SIGNATURE: '',
  ORG_CONFIDENTIALITY: 'CONFIDENTIEL — DIFFUSION RESTREINTE',
  ORG_FOOTER: '',
  ORG_WEBSITE: '',
};

const FIELD_DEFS: { key: keyof OrgBrandingTemplateVars; label: string; placeholder: string; type: 'text' | 'url' | 'color' }[] = [
  { key: 'ORG_NAME', label: 'Nom de l\'organisation', placeholder: 'Ex: TotalEnergies, Ambassade de France, OMS...', type: 'text' },
  { key: 'ORG_SHORT_NAME', label: 'Nom court / Acronyme', placeholder: 'Ex: Total, OMS...', type: 'text' },
  { key: 'ORG_LOGO_URL', label: 'URL du logo', placeholder: 'https://...', type: 'url' },
  { key: 'ORG_COLOR_PRIMARY', label: 'Couleur primaire', placeholder: '#1a1a2e', type: 'color' },
  { key: 'ORG_COLOR_SECONDARY', label: 'Couleur secondaire', placeholder: '#e94560', type: 'color' },
  { key: 'ORG_FONT_HEADING', label: 'Police des titres', placeholder: 'Inter', type: 'text' },
  { key: 'ORG_FONT_BODY', label: 'Police du corps', placeholder: 'Inter', type: 'text' },
  { key: 'ORG_SIGNATURE', label: 'Signature (bas de page)', placeholder: 'Direction Sûreté Groupe', type: 'text' },
  { key: 'ORG_CONFIDENTIALITY', label: 'Mention confidentialité', placeholder: 'CONFIDENTIEL — DIFFUSION RESTREINTE', type: 'text' },
  { key: 'ORG_FOOTER', label: 'Pied de page', placeholder: 'Plateforme sécurisée — Veille Afrique', type: 'text' },
  { key: 'ORG_WEBSITE', label: 'Site web', placeholder: 'https://...', type: 'url' },
];

export default function OrgBrandingPanel() {
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVars, setFormVars] = useState<OrgBrandingTemplateVars>(DEFAULT_TEMPLATE_VARS);
  const [orgName, setOrgName] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('org_branding').select('*').order('is_default', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setBranding(data as OrgBranding);
        setFormVars((data.template_vars || DEFAULT_TEMPLATE_VARS) as OrgBrandingTemplateVars);
        setOrgName(data.org_name || '');
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (branding?.id) {
        await supabase.from('org_branding').update({
          org_name: orgName,
          template_vars: formVars as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        }).eq('id', branding.id);
      } else {
        await supabase.from('org_branding').insert({
          org_name: orgName || 'Mon Organisation',
          org_slug: (orgName || 'mon-org').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 63),
          template_vars: formVars as unknown as Record<string, unknown>,
          is_default: true,
        });
      }
      setToast('Identité enregistrée — les exports utiliseront ce template');
      fetchBranding();
    } catch {
      setToast('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof OrgBrandingTemplateVars, value: string) => {
    setFormVars((prev) => ({ ...prev, [key]: value }));
  };

  const resetToDefault = () => {
    setFormVars(DEFAULT_TEMPLATE_VARS);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // Build preview of a SITREP header
  const previewVars = formVars;
  const previewLines = [
    `${previewVars.ORG_NAME || '[Nom Organisation]'} — Point de Situation Quotidien`,
    previewVars.ORG_CONFIDENTIALITY || '[CONFIDENTIEL]',
    '─'.repeat(50),
    'BILAN 24H : Surveillance active — 54 pays',
    '...',
    '─'.repeat(50),
    `Généré par : ${previewVars.ORG_SIGNATURE || '[Signature]'}`,
    previewVars.ORG_FOOTER || '[Pied de page]',
  ];

  return (
    <div className="space-y-5">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Explanation */}
      <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <i className="ri-palette-line text-amber-700 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Moteur de Templating Marque Blanche</p>
            <p className="text-[10px] text-amber-700 mt-1">
              Ces variables (<code className="bg-amber-100 px-1 rounded">{'{{ ORG_NAME }}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{ ORG_LOGO_URL }}'}</code>, etc.) 
              sont injectées dynamiquement dans tous les exports (Word, Excel, PPT, PDF). 
              Changez l'identité ici — tous les rapports s'adaptent automatiquement.
            </p>
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Nom de l'organisation</label>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex: TotalEnergies, Ambassade de France..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
          {branding?.org_slug && <p className="text-[9px] text-sentiqs-gray-text mt-1">Slug technique : {branding.org_slug}</p>}
        </div>
        {FIELD_DEFS.map((field) => (
          <div key={field.key} className={field.key === 'ORG_LOGO_URL' || field.key === 'ORG_FOOTER' ? 'sm:col-span-2' : ''}>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">
              {field.label} <code className="text-[9px] bg-gray-100 px-1 rounded font-mono">{`{{ ${field.key} }}`}</code>
            </label>
            {field.type === 'color' ? (
              <div className="flex items-center gap-2">
                <input type="color" value={formVars[field.key]} onChange={(e) => updateField(field.key, e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
                <input type="text" value={formVars[field.key]} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy font-mono" />
              </div>
            ) : (
              <input type={field.type} value={formVars[field.key]} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
            )}
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sentiqs-gray-text">Aperçu en-tête rapport</span>
          <span className="text-[9px] text-sentiqs-gray-text">Les balises {'{{ }}'} sont remplacées au moment de l'export</span>
        </div>
        <div className="p-4 font-mono text-[11px] text-sentiqs-navy whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'monospace' }}>
          {previewLines.join('\n')}
        </div>
      </div>

      {/* Templates d'export */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <p className="text-[11px] font-bold text-sentiqs-navy mb-3">Templates d'export personnalisés (optionnel)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Template Word (.docx)</label>
            <input type="url" value={branding?.word_template_url || ''} readOnly placeholder="URL du template..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Template PowerPoint (.pptx)</label>
            <input type="url" value={branding?.ppt_template_url || ''} readOnly placeholder="URL du template..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Template Excel (.xlsx)</label>
            <input type="url" value={branding?.excel_template_url || ''} readOnly placeholder="URL du template..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400" />
          </div>
        </div>
        <p className="text-[9px] text-sentiqs-gray-text mt-2">Fonctionnalité avancée — Contactez le support pour activer l'upload de templates personnalisés.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-xs font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer">
          {saving ? <><i className="ri-loader-4-line animate-spin" /> Enregistrement...</> : <><i className="ri-save-line" /> Enregistrer l'identité</>}
        </button>
        <button type="button" onClick={resetToDefault} className="px-4 py-2.5 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer">
          <i className="ri-refresh-line mr-1" /> Réinitialiser
        </button>
      </div>
    </div>
  );
}