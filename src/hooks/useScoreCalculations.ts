import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ScoreCalculation {
  id: string;
  country_code: string;
  country_name: string;
  rule_version: string;
  computed_at: string;
  score: number;
  level: string;
  feed_ids: string[];
  alert_ids: string[];
  factors: Record<string, number>;
  confidence: number | null;
  explanation: string | null;
  status: 'provisoire' | 'valide' | 'conteste' | 'expire';
}

export interface EvidenceFeed {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  timestamp: string;
}

export interface EvidenceAlert {
  id: string;
  title: string;
  source: string;
  severity: string;
  timestamp: string;
}

/**
 * Récupère la dernière justification persistée pour un pays et résout les
 * feeds/alertes qu'elle cite en titres affichables. Si aucune ligne
 * score_calculations n'existe encore (ex: juste après un premier calcul,
 * avant le debounce de 2s côté useAlertLevels), l'appelant doit afficher
 * "Données justificatives insuffisantes" plutôt qu'inventer une explication.
 */
export function useScoreCalculations(countryCode: string | undefined) {
  const [calculation, setCalculation] = useState<ScoreCalculation | null>(null);
  const [evidenceFeeds, setEvidenceFeeds] = useState<EvidenceFeed[]>([]);
  const [evidenceAlerts, setEvidenceAlerts] = useState<EvidenceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!countryCode) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('score_calculations')
        .select('*')
        .eq('country_code', countryCode)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setCalculation((data as ScoreCalculation) || null);

      if (data) {
        const feedIds: string[] = (data.feed_ids as string[]) || [];
        const alertIds: string[] = (data.alert_ids as string[]) || [];

        const [feedsRes, alertsRes] = await Promise.all([
          feedIds.length > 0
            ? supabase.from('feeds').select('id, title, source, source_url, timestamp').in('id', feedIds)
            : Promise.resolve({ data: [], error: null }),
          alertIds.length > 0
            ? supabase.from('alerts').select('id, title, source, severity, timestamp').in('id', alertIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        setEvidenceFeeds((feedsRes.data || []) as EvidenceFeed[]);
        setEvidenceAlerts((alertsRes.data || []) as EvidenceAlert[]);
      } else {
        setEvidenceFeeds([]);
        setEvidenceAlerts([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  /** Marque la dernière justification comme validée ou contestée par un analyste. */
  const setStatus = useCallback(
    async (status: 'valide' | 'conteste') => {
      if (!calculation) return { success: false, message: 'Aucun calcul à mettre à jour' };
      const { error: updateError } = await supabase
        .from('score_calculations')
        .update({ status })
        .eq('id', calculation.id);

      if (updateError) {
        return { success: false, message: updateError.message };
      }
      setCalculation({ ...calculation, status });
      return { success: true, message: 'Statut mis à jour' };
    },
    [calculation],
  );

  return { calculation, evidenceFeeds, evidenceAlerts, loading, error, refetch: fetchLatest, setStatus };
}
