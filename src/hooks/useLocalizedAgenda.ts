import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { detectLanguage } from '@/utils/languageDetection';
import type { AgendaEvent } from './useAgendaEvents';

export interface LocalizedAgendaEvent extends AgendaEvent {
  displayTitle: string;
  displayDescription?: string;
  isTranslating: boolean;
}

const inFlightIds = new Set<string>();
const BATCH_SIZE = 8;

/**
 * Équivalent de useLocalizedFeeds pour les événements d'agenda : résout
 * automatiquement titre/description dans la langue d'affichage active,
 * en déclenchant translate-agenda-event en arrière-plan si nécessaire.
 */
export function useLocalizedAgenda(events: AgendaEvent[]) {
  const { i18n } = useTranslation();
  const uiLang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const [overrides, setOverrides] = useState<Record<string, { title: string; description?: string; lang: string }>>({});
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    triedRef.current = new Set();
  }, [uiLang]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const candidates = events.filter((e) => {
        if (triedRef.current.has(e.id) || inFlightIds.has(e.id)) return false;
        const cachedMatch = e.translation_lang === uiLang && e.translated_title;
        const overrideMatch = overrides[e.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        if (uiLang === 'en' && e.title_en) return false;
        return detectLanguage(e.title) !== uiLang;
      }).slice(0, BATCH_SIZE);

      for (const event of candidates) {
        if (cancelled) return;
        triedRef.current.add(event.id);
        inFlightIds.add(event.id);
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
          // best-effort
        } finally {
          inFlightIds.delete(event.id);
        }
      }
    }

    if (events.length > 0) run();
    return () => { cancelled = true; };
  }, [events, uiLang, overrides]);

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
