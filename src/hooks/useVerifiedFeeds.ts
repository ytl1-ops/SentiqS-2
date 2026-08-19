import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { computeHallucinationScore, isVerifiedData, isReliableSource, validateSourceUrl } from '@/utils/dataIntegrity';

export interface VerifiedFeed {
  id: string;
  title: string;
  title_en?: string;
  source: string;
  source_url: string;
  timestamp: string;
  category: string;
  country: string;
  department?: string;
  locality?: string;
  verification_status: 'verified' | 'confirmed' | 'unverified' | 'rumor';
  hallucination_score: number;
  summary?: string;
  verified_at?: string;
  source_status?: 'active' | 'warning' | 'dead' | 'unchecked';
  last_link_check?: string;
  link_check_error?: string;
  translated_title?: string;
  translated_summary?: string;
  translation_lang?: string;
  translated_at?: string;
  parent_feed_id?: string | null;
}

interface UseVerifiedFeedsOptions {
  limit?: number;
  /** Inclure les feeds non vérifiés et rumeurs (false par défaut = exclus) */
  includeUnverified?: boolean;
  /** Inclure les feeds avec source morte (false par défaut = exclus) */
  includeDeadSources?: boolean;
}

export function useVerifiedFeeds(options?: UseVerifiedFeedsOptions) {
  const { limit, includeUnverified = false, includeDeadSources = false } = options || {};
  const [feeds, setFeeds] = useState<VerifiedFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('feeds')
        .select('*')
        .not('source_url', 'is', null)
        .order('timestamp', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let filtered = (data || []) as VerifiedFeed[];

      // Filtrage anti-hallucination :
      // 1. Exclure les feeds sans source_url valide
      filtered = filtered.filter((f) => f.source_url && validateSourceUrl(f.source_url));

      // 2. Exclure les feeds non vérifiés / rumeurs (sauf si includeUnverified)
      if (!includeUnverified) {
        filtered = filtered.filter((f) => isVerifiedData({ verification_status: f.verification_status }));
      }

      // 3. Exclure les sources mortes (sauf si includeDeadSources)
      if (!includeDeadSources) {
        filtered = filtered.filter((f) => isReliableSource({ source_url: f.source_url, source_status: f.source_status }));
      }

      // 4. Recalculer le hallucination_score à partir des critères documentés
      filtered = filtered.map((f) => ({
        ...f,
        hallucination_score: computeHallucinationScore({
          source_url: f.source_url,
          source_status: f.source_status,
          verification_status: f.verification_status,
          verified_at: f.verified_at,
          parent_feed_id: f.parent_feed_id,
        }),
      }));

      setFeeds(filtered);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit, includeUnverified, includeDeadSources]);

  useEffect(() => {
    fetchFeeds();

    const channel = supabase
      .channel('feeds-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feeds' },
        () => {
          fetchFeeds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeeds]);

  // Compteurs de transparence
  const counts = useMemo(() => {
    const verified = feeds.filter((f) => isVerifiedData({ verification_status: f.verification_status })).length;
    const unverified = feeds.filter((f) => f.verification_status === 'unverified').length;
    const rumor = feeds.filter((f) => f.verification_status === 'rumor').length;
    const deadSources = feeds.filter((f) => f.source_status === 'dead').length;
    const totalFetched = feeds.length;
    return { verified, unverified, rumor, deadSources, totalFetched };
  }, [feeds]);

  return { feeds, loading, error, refetch: fetchFeeds, counts };
}

export async function verifyFeedWithAgent(feedId: string): Promise<{
  verified: boolean;
  hallucination_score: number;
  flags: string[];
}> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke('verify-feed', {
      body: { feedId },
    });

    if (fnError) throw fnError;

    return {
      verified: data.verified,
      hallucination_score: data.hallucination_score,
      flags: data.flags || [],
    };
  } catch {
    return {
      verified: false,
      hallucination_score: 1.0,
      flags: ['verification_failed'],
    };
  }
}