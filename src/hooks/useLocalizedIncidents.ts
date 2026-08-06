import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { detectLanguage } from '@/utils/languageDetection';
import type { TriggeringIncident } from './useAlertLevels';

export interface LocalizedIncident extends TriggeringIncident {
  displayTitle: string;
  isTranslating: boolean;
}

const inFlightIds = new Set<string>();
// Voir useLocalizedFeeds.ts : les services de traduction gratuits limitent
// le débit par IP partagée, donc un échec est souvent temporaire — on
// retente après un cooldown plutôt que d'abandonner définitivement.
const lastAttemptAt = new Map<string, number>();
const RETRY_COOLDOWN_MS = 20_000;
const RETRY_TIMER_MS = 25_000;

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
      const candidates = incidents.filter((inc) => {
        if (inc.type !== 'feed') return false;
        if (inFlightIds.has(inc.id)) return false;
        const cachedMatch = inc.translation_lang === uiLang && inc.translated_title;
        const overrideMatch = overrides[inc.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        const last = lastAttemptAt.get(inc.id);
        if (last && now - last < RETRY_COOLDOWN_MS) return false;
        return detectLanguage(inc.title) !== uiLang;
      });

      for (const inc of candidates) {
        if (cancelled) return;
        inFlightIds.add(inc.id);
        lastAttemptAt.set(inc.id, Date.now());
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
          // best-effort — une nouvelle tentative aura lieu après le cooldown
        } finally {
          inFlightIds.delete(inc.id);
        }
      }
    }

    if (incidents.length > 0) run();
    return () => { cancelled = true; };
  }, [incidents, uiLang, overrides, retryTick]);

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
