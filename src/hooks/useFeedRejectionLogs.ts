import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface FeedRejectionLog {
  id: number;
  rejected_at: string;
  title: string | null;
  source: string | null;
  source_url: string | null;
  country: string | null;
  category: string | null;
  reason_code: string;
  reason_detail: string;
  attempted_by: string;
  raw_data: Record<string, unknown> | null;
}

export function useFeedRejectionLogs(limit = 50) {
  const [logs, setLogs] = useState<FeedRejectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from('feed_rejection_log')
        .select('*')
        .order('rejected_at', { ascending: false })
        .limit(limit);

      if (supaError) throw supaError;

      setLogs((data || []) as FeedRejectionLog[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}