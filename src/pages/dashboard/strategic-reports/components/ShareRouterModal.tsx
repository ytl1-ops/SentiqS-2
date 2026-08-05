import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ShareChannelType, ExportFormat, ShareDocumentType } from '@/types/strategic';

interface ShareRouterModalProps {
  open: boolean;
  onClose: () => void;
  documentType: ShareDocumentType;
  documentId: string | null;
  documentTitle: string | null;
}

type ShareStep = 'document' | 'format' | 'channel' | 'confirm';

const CHANNELS: { key: ShareChannelType; icon: string; label: string; desc: string; color: string }[] = [
  { key: 'email', icon: 'ri-mail-line', label: 'Email', desc: 'Envoi de rapports et fichiers .ics', color: 'border-rose-200 hover:bg-rose-50 text-rose-700' },
  { key: 'whatsapp', icon: 'ri-whatsapp-line', label: 'WhatsApp', desc: 'Alertes immédiates — zones faible connectivité', color: 'border-emerald-200 hover:bg-emerald-50 text-emerald-700' },
  { key: 'sms', icon: 'ri-message-2-line', label: 'SMS', desc: 'Alertes urgentes — tous réseaux', color: 'border-amber-200 hover:bg-amber-50 text-amber-700' },
  { key: 'google_drive', icon: 'ri-google-line', label: 'Google Drive', desc: 'Archivage automatique', color: 'border-sky-200 hover:bg-sky-50 text-sky-700' },
  { key: 'sharepoint', icon: 'ri-microsoft-line', label: 'SharePoint', desc: 'Archivage entreprise', color: 'border-indigo-200 hover:bg-indigo-50 text-indigo-700' },
  { key: 'image_capture', icon: 'ri-image-line', label: 'Image', desc: 'Capture asynchrone — carte annotée', color: 'border-violet-200 hover:bg-violet-50 text-violet-700' },
];

const FORMATS: { key: ExportFormat; icon: string; label: string; channels: ShareChannelType[] }[] = [
  { key: 'pdf', icon: 'ri-file-pdf-2-line', label: 'PDF', channels: ['email', 'google_drive', 'sharepoint'] },
  { key: 'word', icon: 'ri-file-word-2-line', label: 'Word', channels: ['email', 'google_drive', 'sharepoint'] },
  { key: 'excel', icon: 'ri-file-excel-2-line', label: 'Excel', channels: ['email', 'google_drive', 'sharepoint'] },
  { key: 'ppt', icon: 'ri-file-ppt-2-line', label: 'PowerPoint', channels: ['email', 'google_drive', 'sharepoint'] },
  { key: 'csv', icon: 'ri-file-text-line', label: 'CSV (Microsoft Lists)', channels: ['email', 'google_drive', 'sharepoint'] },
  { key: 'image', icon: 'ri-image-line', label: 'Image', channels: ['email', 'whatsapp', 'image_capture'] },
  { key: 'sms_text', icon: 'ri-message-3-line', label: 'Texte SMS', channels: ['sms'] },
  { key: 'whatsapp_text', icon: 'ri-whatsapp-line', label: 'Texte WhatsApp', channels: ['whatsapp'] },
  { key: 'ical', icon: 'ri-calendar-line', label: 'Agenda (.ics)', channels: ['email'] },
];

export default function ShareRouterModal({ open, onClose, documentType, documentId, documentTitle }: ShareRouterModalProps) {
  const [step, setStep] = useState<ShareStep>('document');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ShareChannelType | null>(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userOrg, setUserOrg] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setStep('document');
    setSelectedFormat(null);
    setSelectedChannel(null);
    setRecipient('');
    setMessage('');
    setUserName('');
    setUserRole('');
    setUserOrg('');
    setStatus('idle');
    setErrorMsg(null);
    onClose();
  };

  const availableFormats = FORMATS.filter((f) => selectedChannel ? f.channels.includes(selectedChannel) : true);

  const needsEmail = selectedChannel === 'email';
  const needsPhone = selectedChannel === 'whatsapp' || selectedChannel === 'sms';

  const canSend = selectedFormat && selectedChannel && recipient.trim() && userName.trim() && userRole.trim() && userOrg.trim();

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setStatus('idle');
    setErrorMsg(null);

    try {
      const { error } = await supabase.functions.invoke('share-dispatch', {
        body: {
          document_type: documentType,
          document_id: documentId,
          document_title: documentTitle,
          export_format: selectedFormat,
          channel: selectedChannel,
          recipient,
          message: message || null,
          user_name: userName,
          user_role: userRole,
          user_org: userOrg,
        },
      });

      if (error) throw error;
      setStatus('success');
      setTimeout(handleClose, 2000);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erreur d\'envoi');
    } finally {
      setSending(false);
    }
  };

  const channelNeedsRecipient = (ch: ShareChannelType) => ['email', 'whatsapp', 'sms'].includes(ch);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl border border-gray-100 w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with step indicator */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-sentiqs-navy">Partager — Routeur Omnicanal</h3>
            <p className="text-[10px] text-sentiqs-gray-text mt-0.5">
              {documentType} {documentId ? `#${documentId}` : ''} — {documentTitle || 'Sans titre'}
            </p>
            {/* Step indicator */}
            <div className="flex items-center gap-1 mt-2">
              {(['document', 'format', 'channel', 'confirm'] as ShareStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    step === s ? 'bg-sentiqs-navy text-white' :
                    ['document', 'format', 'channel', 'confirm'].indexOf(step) > i ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-400'
                  }`}>{i + 1}</span>
                  {i < 3 && <span className="w-4 h-px bg-gray-200" />}
                </div>
              ))}
              <span className="text-[9px] font-semibold text-sentiqs-gray-text ml-1.5">{
                step === 'document' ? 'Document' : step === 'format' ? 'Format' : step === 'channel' ? 'Canal' : 'Envoi'
              }</span>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-sentiqs-gray-text transition-colors cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Step 1: Document (auto-confirmed from props) */}
          {step === 'document' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider mb-1">Document sélectionné</p>
                <p className="text-xs font-semibold text-sentiqs-navy">{documentTitle || 'Document sans titre'}</p>
                <p className="text-[10px] text-sentiqs-gray-text mt-0.5">Type : {documentType} {documentId ? `• ID : ${documentId}` : ''}</p>
              </div>
              <button type="button" onClick={() => setStep('format')} className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                Continuer — Choisir le format
              </button>
            </div>
          )}

          {/* Step 2: Choose Format */}
          {step === 'format' && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-sentiqs-navy">Choisissez le format d'export</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((fmt) => (
                  <button
                    key={fmt.key}
                    type="button"
                    onClick={() => { setSelectedFormat(fmt.key); setSelectedChannel(null); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                      selectedFormat === fmt.key
                        ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                        : 'bg-white border-gray-200 text-sentiqs-gray-text hover:border-sentiqs-navy/30'
                    }`}
                  >
                    <i className={`${fmt.icon} text-lg ${selectedFormat === fmt.key ? '' : 'text-sentiqs-navy'}`} />
                    {fmt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('document')} className="flex-1 px-4 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                  Retour
                </button>
                <button type="button" onClick={() => selectedFormat && setStep('channel')} disabled={!selectedFormat} className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-sentiqs-navy rounded-lg hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap">
                  Choisir le canal
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Choose Channel */}
          {step === 'channel' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <i className={`${FORMATS.find((f) => f.key === selectedFormat)?.icon} text-lg text-sentiqs-navy`} />
                <span className="text-xs font-semibold text-sentiqs-navy">Format : {FORMATS.find((f) => f.key === selectedFormat)?.label}</span>
              </div>
              <p className="text-[11px] font-semibold text-sentiqs-navy">Choisissez le canal de diffusion</p>
              <div className="space-y-2">
                {CHANNELS.filter((ch) => selectedFormat ? FORMATS.find((f) => f.key === selectedFormat)?.channels.includes(ch.key) : true).map((ch) => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setSelectedChannel(ch.key)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      selectedChannel === ch.key
                        ? `${ch.color} bg-opacity-10 ring-2 ring-current/30`
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <i className={`${ch.icon} text-lg ${selectedChannel === ch.key ? '' : 'text-sentiqs-navy'}`} />
                    <div className="text-left">
                      <p className="text-[11px] font-semibold">{ch.label}</p>
                      <p className="text-[9px] text-sentiqs-gray-text">{ch.desc}</p>
                    </div>
                    {selectedChannel === ch.key && <i className="ri-checkbox-circle-fill text-lg ml-auto text-current" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('format')} className="flex-1 px-4 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                  Retour
                </button>
                <button type="button" onClick={() => selectedChannel && setStep('confirm')} disabled={!selectedChannel} className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-sentiqs-navy rounded-lg hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap">
                  Confirmer
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm & Send */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-1.5">
                <div className="flex items-center gap-2 text-[10px]">
                  <i className={`${FORMATS.find((f) => f.key === selectedFormat)?.icon} text-sentiqs-navy`} />
                  <span className="font-semibold text-sentiqs-navy">{FORMATS.find((f) => f.key === selectedFormat)?.label}</span>
                  <i className="ri-arrow-right-line text-sentiqs-gray-text" />
                  <i className={`${CHANNELS.find((c) => c.key === selectedChannel)?.icon} text-sentiqs-navy`} />
                  <span className="font-semibold text-sentiqs-navy">{CHANNELS.find((c) => c.key === selectedChannel)?.label}</span>
                </div>
                <p className="text-[10px] text-sentiqs-gray-text">{documentTitle || 'Document'}</p>
              </div>

              {/* Identity */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <i className="ri-user-settings-line text-xs" /> Votre identité <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nom complet" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                  <input type="text" value={userRole} onChange={(e) => setUserRole(e.target.value)} placeholder="Fonction" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                  <input type="text" value={userOrg} onChange={(e) => setUserOrg(e.target.value)} placeholder="Organisation" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy" />
                </div>
              </div>

              {/* Recipient */}
              {channelNeedsRecipient(selectedChannel!) && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">
                    Destinataire <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={needsEmail ? 'email' : 'tel'}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={needsEmail ? 'email@organisation.com' : '+225 XX XX XX XX'}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy"
                  />
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentiqs-gray-text mb-1">Message (optionnel)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} placeholder="Commentaire..." className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-sentiqs-navy resize-none" />
              </div>

              {/* Status */}
              {status === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <i className="ri-checkbox-circle-fill" /> Envoyé avec succès — enregistré dans le journal d'audit
                </div>
              )}
              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2 text-red-600 text-xs font-semibold">
                  <i className="ri-error-warning-fill" /> {errorMsg || "Erreur d'envoi"}
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('channel')} className="flex-1 px-4 py-2 text-xs font-semibold text-sentiqs-gray-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend || sending}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-sentiqs-navy rounded-lg hover:bg-sentiqs-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {sending ? (
                    <><i className="ri-loader-4-line animate-spin" /> Envoi...</>
                  ) : (
                    <><i className="ri-send-plane-fill" /> Envoyer</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}