import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

type ChatMode = 'grounded' | 'general';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const accent: Record<ChatMode, { bg: string; bgHover: string; text: string; ring: string; iconBg: string }> = {
  grounded: { bg: 'bg-emerald-600', bgHover: 'hover:bg-emerald-700', text: 'text-emerald-600', ring: 'ring-emerald-600', iconBg: 'bg-emerald-50' },
  general: { bg: 'bg-indigo-600', bgHover: 'hover:bg-indigo-700', text: 'text-indigo-600', ring: 'ring-indigo-600', iconBg: 'bg-indigo-50' },
};

export default function ChatAssistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('grounded');
  const [groundedMessages, setGroundedMessages] = useState<ChatMsg[]>([]);
  const [generalMessages, setGeneralMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = mode === 'grounded' ? groundedMessages : generalMessages;
  const setMessages = mode === 'grounded' ? setGroundedMessages : setGeneralMessages;
  const c = accent[mode];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ask-sentiqs', { body: { message: text, history, mode } });
      if (error) throw error;
      if (data?.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.serviceUnavailable'), error: true }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer || t('chat.emptyAnswer') }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.serviceUnavailable'), error: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, mode, setMessages, t]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
          aria-label={t('chat.open')}
        >
          <i className="ri-question-answer-line text-2xl" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[9998] w-[360px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${c.iconBg}`}>
                <i className={`${mode === 'grounded' ? 'ri-shield-star-line' : 'ri-chat-smile-2-line'} text-lg transition-colors ${c.text}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-sentiqs-navy truncate">
                  {mode === 'grounded' ? t('chat.title') : t('chat.generalTitle')}
                </p>
                <p className="text-[10px] text-sentiqs-gray-text truncate">
                  {mode === 'grounded' ? t('chat.subtitle') : t('chat.generalSubtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setMessages([])}
                title={t('chat.reset')}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sentiqs-gray-text cursor-pointer"
              >
                <i className="ri-refresh-line text-sm" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sentiqs-gray-text cursor-pointer"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          </div>

          {/* Sélecteur de mode — deux assistants distincts, pas de confusion possible */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMode('grounded')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'grounded' ? 'bg-emerald-600 text-white' : 'bg-white text-sentiqs-gray-text border border-gray-200 hover:border-gray-300'
              }`}
            >
              <i className="ri-shield-star-line text-xs" /> {t('chat.tabGrounded')}
            </button>
            <button
              type="button"
              onClick={() => setMode('general')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'general' ? 'bg-indigo-600 text-white' : 'bg-white text-sentiqs-gray-text border border-gray-200 hover:border-gray-300'
              }`}
            >
              <i className="ri-chat-smile-2-line text-xs" /> {t('chat.tabGeneral')}
            </button>
          </div>

          {mode === 'general' && (
            <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
              <p className="text-[9.5px] text-indigo-700 leading-snug">
                <i className="ri-information-line" /> {t('chat.generalDisclaimer')}
              </p>
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-sentiqs-gray-bg/40">
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <p className="text-xs text-sentiqs-gray-text leading-relaxed px-4">
                  {mode === 'grounded' ? t('chat.intro') : t('chat.generalIntro')}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-sentiqs-navy text-white rounded-br-sm'
                      : m.error
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-sm'
                        : 'bg-white text-sentiqs-navy border border-gray-100 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mode === 'grounded' ? t('chat.placeholder') : t('chat.generalPlaceholder')}
              className="flex-1 px-3 py-2 rounded-full text-xs border border-gray-200 focus:outline-none focus:border-sentiqs-navy text-sentiqs-navy placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || loading}
              className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer transition-colors ${c.bg} ${c.bgHover}`}
            >
              <i className="ri-send-plane-fill text-sm" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
