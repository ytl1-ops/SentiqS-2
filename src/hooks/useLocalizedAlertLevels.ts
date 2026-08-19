import { useMemo } from 'react';
import { useLocalizedIncidents, type LocalizedIncident } from './useLocalizedIncidents';
import type { CountryAlertLevel } from './useAlertLevels';

export interface LocalizedCountryAlertLevel extends Omit<CountryAlertLevel, 'triggeringIncidents'> {
  triggeringIncidents: LocalizedIncident[];
}

/**
 * Enveloppe useAlertLevels : remplace les triggeringIncidents de chaque pays
 * par leur version localisée (displayTitle résolu dans la langue active),
 * en réutilisant la même infrastructure de traduction que les actus.
 */
export function useLocalizedAlertLevels(levels: CountryAlertLevel[]) {
  const flatIncidents = useMemo(() => {
    const map = new Map<string, CountryAlertLevel['triggeringIncidents'][number]>();
    levels.forEach((l) => l.triggeringIncidents.forEach((inc) => {
      if (!map.has(inc.id)) map.set(inc.id, inc);
    }));
    return Array.from(map.values());
  }, [levels]);

  const { incidents: localizedFlat } = useLocalizedIncidents(flatIncidents);

  const localizedById = useMemo(() => {
    const map = new Map<string, LocalizedIncident>();
    localizedFlat.forEach((inc) => map.set(inc.id, inc));
    return map;
  }, [localizedFlat]);

  const localizedLevels = useMemo<LocalizedCountryAlertLevel[]>(() => {
    return levels.map((l) => ({
      ...l,
      triggeringIncidents: l.triggeringIncidents.map((inc) => localizedById.get(inc.id) || { ...inc, displayTitle: inc.title, isTranslating: false }),
    }));
  }, [levels, localizedById]);

  return { levels: localizedLevels };
}
