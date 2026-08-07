import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { detectLanguage } from '@/utils/languageDetection';
import { processWithConcurrency } from '@/utils/concurrency';
import type { AgendaEvent } from './useAgendaEvents';

export interface LocalizedAgendaEvent extends AgendaEvent {
  displayTitle: string;
  displayDescription?: string;
  isTranslating: boolean;
}

const inFlightIds = new Set<string>();
// Voir useLocalizedFeeds.ts : les services de traduction gratuits limitent
// le débit par IP partagée, donc un échec est souvent temporaire — on
// retente après un cooldown plutôt que d'abandonner définitivement.
const lastAttemptAt = new Map<string, number>();
const RETRY_COOLDOWN_MS = 20_000;
const RETRY_TIMER_MS = 25_000;
const TRANSLATE_CONCURRENCY = 5;

/**
 * Équivalent de useLocalizedFeeds pour les événements d'agenda : résout
 * automatiquement titre/description dans la langue d'affichage active,
 * en déclenchant translate-agenda-event en arrière-plan si nécessaire.
 */
export function useLocalizedAgenda(events: AgendaEvent[]) {
  const { i18n } = useTranslation();
  const uiLang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const [overrides, setOverrides] = useState<Record<string, { title: string; description?: string; lang: string }>>({});
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setRetryTick(0);
  }, [uiLang]);

  useEffect(() => {
    const timer = setInterval(() => setRetryTick((t) => t + 1), RETRY_TIMER_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const now = Date.now();
      const candidates = events.filter((e) => {
        if (inFlightIds.has(e.id)) return false;
        const cachedMatch = e.translation_lang === uiLang && e.translated_title;
        const overrideMatch = overrides[e.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        if (uiLang === 'en' && e.title_en) return false;
        const last = lastAttemptAt.get(e.id);
        if (last && now - last < RETRY_COOLDOWN_MS) return false;
        return detectLanguage(e.title) !== uiLang;
      });

      await processWithConcurrency(
        candidates,
        async (event) => {
          inFlightIds.add(event.id);
          lastAttemptAt.set(event.id, Date.now());
          try {
            const { data, error } = await supabase.functions.invoke('translate-agenda-event', {
              body: { eventId: event.id, targetLang: uiLang },
            });
            if (!cancelled && !error && data?.translated_title) {
              setOverrides((prev) => ({
                ...prev,
                [event.id]: { title: data.translated_title, description: data.translated_description, lang: uiLang },
              }));
            }
          } catch {
            // best-effort — une nouvelle tentative aura lieu après le cooldown
          } finally {
            inFlightIds.delete(event.id);
          }
        },
        TRANSLATE_CONCURRENCY,
        () => cancelled,
      );
    }

    if (events.length > 0) run();
    return () => { cancelled = true; };
  }, [events, uiLang, overrides, retryTick]);

  const localizedEvents = useMemo<LocalizedAgendaEvent[]>(() => {
    return events.map((e) => {
      const override = overrides[e.id];
      let displayTitle = e.title;
      let displayDescription = e.description;

      if (override?.lang === uiLang) {
        displayTitle = override.title;
        displayDescription = override.description ?? displayDescription;
      } else if (e.translation_lang === uiLang && e.translated_title) {
        displayTitle = e.translated_title;
        displayDescription = e.translated_description ?? displayDescription;
      } else if (uiLang === 'en' && e.title_en) {
        displayTitle = e.title_en;
        displayDescription = e.description_en ?? displayDescription;
      }

      return { ...e, displayTitle, displayDescription, isTranslating: inFlightIds.has(e.id) };
    });
  }, [events, overrides, uiLang]);

  return { events: localizedEvents };
}
