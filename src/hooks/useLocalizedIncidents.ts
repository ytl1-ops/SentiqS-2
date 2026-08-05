import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { detectLanguage } from '@/utils/languageDetection';
import type { TriggeringIncident } from './useAlertLevels';

export interface LocalizedIncident extends TriggeringIncident {
  displayTitle: string;
  isTranslating: boolean;
}

// Partagé avec useLocalizedFeeds pour éviter les appels concurrents redondants
// sur le même feed lorsqu'il apparaît à la fois comme actu et comme incident.
const inFlightIds = new Set<string>();
const BATCH_SIZE = 8;

/**
 * Résout le titre affiché de chaque incident déclencheur (alertes + actus)
 * dans la langue d'affichage active. Seuls les incidents de type 'feed'
 * disposent de l'infrastructure de traduction (colonnes translated_title
 * sur la table feeds + fonction translate-feed) : les alertes structurées
 * sont affichées telles quelles, sans traduction fabriquée.
 */
export function useLocalizedIncidents(incidents: TriggeringIncident[]) {
  const { i18n } = useTranslation();
  const uiLang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const [overrides, setOverrides] = useState<Record<string, { title: string; lang: string }>>({});
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    triedRef.current = new Set();
  }, [uiLang]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const candidates = incidents.filter((inc) => {
        if (inc.type !== 'feed') return false;
        if (triedRef.current.has(inc.id) || inFlightIds.has(inc.id)) return false;
        const cachedMatch = inc.translation_lang === uiLang && inc.translated_title;
        const overrideMatch = overrides[inc.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        return detectLanguage(inc.title) !== uiLang;
      }).slice(0, BATCH_SIZE);

      for (const inc of candidates) {
        if (cancelled) return;
        triedRef.current.add(inc.id);
        inFlightIds.add(inc.id);
        try {
          const { data, error } = await supabase.functions.invoke('translate-feed', {
            body: { feedId: inc.id, targetLang: uiLang },
          });
          if (!cancelled && !error && data?.translated_title) {
            setOverrides((prev) => ({
              ...prev,
              [inc.id]: { title: data.translated_title, lang: uiLang },
            }));
          }
        } catch {
          // best-effort — le titre original reste affiché
        } finally {
          inFlightIds.delete(inc.id);
        }
      }
    }

    if (incidents.length > 0) run();
    return () => { cancelled = true; };
  }, [incidents, uiLang, overrides]);

  const localizedIncidents = useMemo<LocalizedIncident[]>(() => {
    return incidents.map((inc) => {
      const override = overrides[inc.id];
      let displayTitle = inc.title;

      if (override?.lang === uiLang) {
        displayTitle = override.title;
      } else if (inc.translation_lang === uiLang && inc.translated_title) {
        displayTitle = inc.translated_title;
      }

      return { ...inc, displayTitle, isTranslating: inFlightIds.has(inc.id) };
    });
  }, [incidents, overrides, uiLang]);

  return { incidents: localizedIncidents };
}
