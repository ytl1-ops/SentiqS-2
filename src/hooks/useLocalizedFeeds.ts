import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { detectLanguage } from '@/utils/languageDetection';
import type { VerifiedFeed } from './useVerifiedFeeds';

export interface LocalizedFeed extends VerifiedFeed {
  displayTitle: string;
  displaySummary?: string;
  isTranslating: boolean;
}

// Partagé entre toutes les instances du hook pour éviter des appels de
// traduction concurrents redondants sur le même flux si plusieurs
// composants (ex: FeedsList + NewsHeroFeed) l'affichent simultanément.
const inFlightIds = new Set<string>();
// Horodatage de la dernière tentative par flux, partagé lui aussi — les
// services de traduction gratuits (Google/MyMemory/Lingva) limitent le
// débit par IP partagée entre tous les utilisateurs de l'app ; un échec
// n'est donc souvent que temporaire. On retente après ce délai plutôt que
// d'abandonner définitivement (bug précédent : un flux resté non traduit
// après un seul échec ne l'était plus jamais, même si le service redevenait
// disponible quelques secondes plus tard).
const lastAttemptAt = new Map<string, number>();
const RETRY_COOLDOWN_MS = 20_000;
const RETRY_TIMER_MS = 25_000;

/**
 * Résout automatiquement le titre/résumé de chaque flux dans la langue
 * d'affichage active (FR ou EN), en déclenchant une traduction en arrière-
 * plan via translate-feed quand le contenu n'est pas déjà dans cette
 * langue (détection heuristique, sans appel réseau superflu quand le
 * contenu correspond déjà). Les traductions sont mises en cache côté
 * base (translated_title/translation_lang) donc les passages suivants
 * sont gratuits.
 */
export function useLocalizedFeeds(feeds: VerifiedFeed[]) {
  const { i18n } = useTranslation();
  const uiLang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const [overrides, setOverrides] = useState<Record<string, { title: string; summary?: string; lang: string }>>({});
  const [retryTick, setRetryTick] = useState(0);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    setRetryTick(0);
  }, [uiLang]);

  // Relance périodique pour retenter les flux en échec, sans bombarder les
  // fournisseurs en continu (le cooldown par flux limite déjà la fréquence).
  useEffect(() => {
    const timer = setInterval(() => setRetryTick((t) => t + 1), RETRY_TIMER_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const now = Date.now();
      const candidates = feeds.filter((f) => {
        if (inFlightIds.has(f.id)) return false;
        const cachedMatch = f.translation_lang === uiLang && f.translated_title;
        const overrideMatch = overrides[f.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        const last = lastAttemptAt.get(f.id);
        if (last && now - last < RETRY_COOLDOWN_MS) return false;
        return detectLanguage(f.title) !== uiLang;
      });

      for (const feed of candidates) {
        if (cancelled) return;
        inFlightIds.add(feed.id);
        lastAttemptAt.set(feed.id, Date.now());
        try {
          const { data, error } = await supabase.functions.invoke('translate-feed', {
            body: { feedId: feed.id, targetLang: uiLang },
          });
          if (!cancelled) {
            if (!error && data?.translated_title) {
              setOverrides((prev) => ({
                ...prev,
                [feed.id]: { title: data.translated_title, summary: data.translated_summary, lang: uiLang },
              }));
            } else if (error) {
              setTranslationError((error as Error).message || 'translation_failed');
            }
          }
        } catch {
          // best-effort — le texte original reste affiché, une nouvelle
          // tentative aura lieu après le cooldown
        } finally {
          inFlightIds.delete(feed.id);
        }
      }
    }

    if (feeds.length > 0) run();
    return () => { cancelled = true; };
  }, [feeds, uiLang, overrides, retryTick]);

  const localizedFeeds = useMemo<LocalizedFeed[]>(() => {
    return feeds.map((f) => {
      const override = overrides[f.id];
      let displayTitle = f.title;
      let displaySummary = f.summary;

      if (override?.lang === uiLang) {
        displayTitle = override.title;
        displaySummary = override.summary ?? displaySummary;
      } else if (f.translation_lang === uiLang && f.translated_title) {
        displayTitle = f.translated_title;
        displaySummary = f.translated_summary ?? displaySummary;
      }

      return { ...f, displayTitle, displaySummary, isTranslating: inFlightIds.has(f.id) };
    });
  }, [feeds, overrides, uiLang]);

  return { feeds: localizedFeeds, translationError };
}
