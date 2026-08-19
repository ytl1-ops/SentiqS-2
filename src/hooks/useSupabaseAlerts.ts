import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { isVerifiedData, isReliableSource, validateSourceUrl } from '@/utils/dataIntegrity';

export interface SupabaseAlert {
  id: string;
  severity: string;
  title: string;
  title_en?: string;
  country: string;
  region: string;
  department: string;
  locality: string;
  timestamp: string;
  source: string;
  category: string;
  status: string;
  impact: string;
  verification_status: string;
  source_url?: string | null;
  source_status?: string | null;
  created_at: string;
}

interface UseSupabaseAlertsOptions {
  limit?: number;
  severity?: string;
  status?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  /** Filtrer pour n'afficher que les alertes vérifiées (défaut: true) */
  verifiedOnly?: boolean;
  /** Exclure les alertes sans source_url valide (défaut: true) */
  requireSourceUrl?: boolean;
}

export function useSupabaseAlerts(options?: UseSupabaseAlertsOptions) {
  const { verifiedOnly = true, requireSourceUrl = true } = options || {};
  const [alerts, setAlerts] = useState<SupabaseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('alerts')
        .select('*')
        .order(options?.orderBy || 'timestamp', { ascending: options?.orderDir === 'asc' });

      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let filtered = (data || []) as SupabaseAlert[];

      // Filtrage anti-hallucination
      if (verifiedOnly) {
        filtered = filtered.filter((a) => isVerifiedData({ verification_status: a.verification_status }));
      }

      if (requireSourceUrl) {
        filtered = filtered.filter((a) => {
          if (!a.source_url) return false;
          return validateSourceUrl(a.source_url);
        });
      }

      // Exclure les sources mortes
      filtered = filtered.filter((a) =>
        isReliableSource({ source_url: a.source_url ?? null, source_status: a.source_status })
      );

      setAlerts(filtered);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [options?.limit, options?.severity, options?.status, options?.orderBy, options?.orderDir, verifiedOnly, requireSourceUrl]);

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const counts = useMemo(() => {
    return {
      total: alerts.length,
      verifiedCount: alerts.filter((a) => isVerifiedData({ verification_status: a.verification_status })).length,
    };
  }, [alerts]);

  return { alerts, loading, error, refetch: fetchAlerts, counts };
}

export function useSupabaseCriticalAlerts() {
  const [criticalAlerts, setCriticalAlerts] = useState<SupabaseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCritical = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('alerts')
        .select('*')
        .eq('severity', 'critical')
        .eq('status', 'active')
        .in('verification_status', ['verified', 'confirmed'])
        .order('timestamp', { ascending: false });

      if (fetchError) throw fetchError;

      let filtered = (data || []) as SupabaseAlert[];

      // Exclure les sources mortes
      filtered = filtered.filter((a) =>
        isReliableSource({ source_url: a.source_url ?? null, source_status: a.source_status })
      );

      setCriticalAlerts(filtered);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCritical();

    const channel = supabase
      .channel('critical-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: 'severity=eq.critical' }, () => {
        fetchCritical();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCritical]);

  return { criticalAlerts, loading, error, refetch: fetchCritical };
}