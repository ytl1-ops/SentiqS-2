/**
 * Détection heuristique légère de la langue d'un texte (fr/en/autre),
 * sans appel réseau. Utilisée pour ne déclencher une traduction que
 * lorsque c'est réellement nécessaire (le texte n'est pas déjà dans la
 * langue d'affichage active) plutôt que d'appeler l'API de traduction sur
 * chaque flux sans distinction.
 */

const ARABIC_RANGE = /[؀-ۿ]/;

const FRENCH_MARKERS = /\b(le|la|les|des|une|un|dans|pour|avec|sur|qui|que|est|été|sont|leur|cette|selon|après|région|pays|gouvernement)\b/gi;
const FRENCH_ACCENTS = /[éèêàçùôî]/g;

const ENGLISH_MARKERS = /\b(the|and|for|with|has|been|from|this|that|are|was|were|said|will|their|after|according|country|government)\b/gi;

export type DetectedLanguage = 'fr' | 'en' | 'other';

export function detectLanguage(text: string | null | undefined): DetectedLanguage {
  if (!text || text.trim().length < 8) return 'other';

  if (ARABIC_RANGE.test(text)) return 'other';

  const frenchScore = (text.match(FRENCH_MARKERS)?.length || 0) + (text.match(FRENCH_ACCENTS)?.length || 0) * 0.5;
  const englishScore = text.match(ENGLISH_MARKERS)?.length || 0;

  if (frenchScore === 0 && englishScore === 0) return 'other';
  return frenchScore >= englishScore ? 'fr' : 'en';
}
