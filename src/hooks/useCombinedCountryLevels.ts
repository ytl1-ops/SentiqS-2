import { useMemo } from 'react';
import type { CountryAlertLevel } from '@/hooks/useAlertLevels';
import type { LocalizedCountryAlertLevel } from '@/hooks/useLocalizedAlertLevels';
import type { ValidatedPosture } from '@/hooks/useValidatedPosture';
import type { NiveauAlerte } from '@/data/countryRiskBaseline';

export interface CombinedCountryLevel extends CountryAlertLevel {
  /** Niveau à afficher en priorité : validé (verrouillé) si disponible, sinon signal automatique. */
  displayLevel: NiveauAlerte;
  displayScore: number;
  /** true si le niveau affiché provient d'une posture validée/verrouillée (analyste ou revue documentaire). */
  isValidated: boolean;
  validated?: ValidatedPosture;
  /** Signal automatique temps réel (flux RSS), toujours calculé, montré à titre de complément. */
  autoLevel: NiveauAlerte;
  autoScore: number;
}

/**
 * Forme finale utilisée par les composants d'affichage : le résultat de
 * useLocalizedAlertLevels (triggeringIncidents traduits) enrichi des champs
 * de useCombinedCountryLevels. Les deux hooks composent en pratique (voir
 * AlertsPage/DashboardOverview) ; ce type nomme la forme combinée pour que
 * les composants n'aient pas à caster localement.
 */
export type DisplayCountryLevel = LocalizedCountryAlertLevel & {
  displayLevel: NiveauAlerte;
  displayScore: number;
  isValidated: boolean;
  validated?: ValidatedPosture;
  autoLevel: NiveauAlerte;
  autoScore: number;
};

/**
 * Combine le signal automatique (useAlertLevels, recalculé en direct à
 * partir des flux RSS) avec la posture validée (useValidatedPosture,
 * country_posture_state verrouillé). Sur une plateforme de référence,
 * l'affichage principal doit être le niveau qu'un analyste peut justifier
 * et sourcer — pas seulement un volume d'articles. Le signal automatique
 * reste visible en complément (transparence), jamais masqué.
 */
export function useCombinedCountryLevels(
  liveLevels: CountryAlertLevel[],
  postures: Map<string, ValidatedPosture>,
): CombinedCountryLevel[] {
  return useMemo(() => {
    const combined = liveLevels.map((l): CombinedCountryLevel => {
      const validated = postures.get(l.countryCode);
      const isValidated = !!validated?.isLocked;
      return {
        ...l,
        autoLevel: l.level,
        autoScore: l.score,
        displayLevel: isValidated ? validated!.level : l.level,
        displayScore: isValidated ? validated!.score : l.score,
        isValidated,
        validated,
      };
    });
    combined.sort((a, b) => b.displayScore - a.displayScore);
    return combined;
  }, [liveLevels, postures]);
}
