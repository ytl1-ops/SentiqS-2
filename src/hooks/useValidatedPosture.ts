import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { NiveauAlerte, SubZone } from '@/data/countryRiskBaseline';

export interface ValidatedPosture {
  countryCode: string;
  countryName: string;
  level: NiveauAlerte;
  score: number;
  isLocked: boolean;
  lockedBy: string | null;
  lockedReason: string | null;
  lockedAt: string | null;
  sources: string[];
  factors: string[];
  subZones: SubZone[];
  usAdvisoryLevel: number | null;
  confidence: 'haute' | 'moyenne' | 'faible' | null;
  rawAutoLevel: string | null;
  rawAutoScore: number | null;
  rawAutoUpdatedAt: string | null;
  updatedAt: string;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Lit la posture pays "validée" (country_posture_state), c'est-à-dire
 * la référence verrouillée par un analyste ou par la revue documentaire
 * (src/data/countryRiskBaseline.ts) — par opposition au signal
 * automatique temps réel calculé par useAlertLevels() à partir des flux
 * RSS. C'est cette source qui doit primer dans l'affichage des modules
 * "Niveau d'alerte" et "Vue d'ensemble" d'une plateforme de référence :
 * un niveau affiché doit être explicable et sourcé, pas seulement
 * dérivé d'un volume d'articles.
 */
export function useValidatedPosture() {
  const [postures, setPostures] = useState<Map<string, ValidatedPosture>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPostures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('country_posture_state')
        .select('*');

      if (fetchError) throw fetchError;

      const map = new Map<string, ValidatedPosture>();
      (data || []).forEach((row) => {
        map.set(row.country_code, {
          countryCode: row.country_code,
          countryName: row.country_name,
          level: (row.level as NiveauAlerte) || 'vert',
          score: Number(row.score) || 0,
          isLocked: !!row.is_locked,
          lockedBy: row.locked_by ?? null,
          lockedReason: row.locked_reason ?? null,
          lockedAt: row.locked_at ?? null,
          sources: parseJsonArray<string>(row.sources),
          factors: parseJsonArray<string>(row.factors),
          subZones: parseJsonArray<SubZone>(row.sub_zones),
          usAdvisoryLevel: row.us_advisory_level ?? null,
          confidence: row.confidence ?? null,
          rawAutoLevel: row.raw_auto_level ?? null,
          rawAutoScore: row.raw_auto_score !== null && row.raw_auto_score !== undefined ? Number(row.raw_auto_score) : null,
          rawAutoUpdatedAt: row.raw_auto_updated_at ?? null,
          updatedAt: row.updated_at,
        });
      });
      setPostures(map);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPostures();

    const channel = supabase
      .channel('validated-posture-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'country_posture_state' }, () => {
        fetchPostures();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPostures]);

  return { postures, loading, error, refetch: fetchPostures };
}
