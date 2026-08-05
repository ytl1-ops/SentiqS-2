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
const BATCH_SIZE = 8;

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
  const triedRef = useRef<Set<string>>(new Set());
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    triedRef.current = new Set();
  }, [uiLang]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const candidates = feeds.filter((f) => {
        if (triedRef.current.has(f.id) || inFlightIds.has(f.id)) return false;
        const cachedMatch = f.translation_lang === uiLang && f.translated_title;
        const overrideMatch = overrides[f.id]?.lang === uiLang;
        if (cachedMatch || overrideMatch) return false;
        return detectLanguage(f.title) !== uiLang;
      }).slice(0, BATCH_SIZE);

      for (const feed of candidates) {
        if (cancelled) return;
        triedRef.current.add(feed.id);
        inFlightIds.add(feed.id);
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
          // best-effort — le texte original reste affiché
        } finally {
          inFlightIds.delete(feed.id);
        }
      }
    }

    if (feeds.length > 0) run();
    return () => { cancelled = true; };
  }, [feeds, uiLang, overrides]);

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
