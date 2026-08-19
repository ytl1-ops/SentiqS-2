import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AutoScanResult {
  ran: boolean;
  link_check?: {
    total: number;
    active: number;
    warning: number;
    dead: number;
  };
  integrity_guard?: {
    scanned: number;
    violations_found: number;
    auto_fixed: number;
    breakdown: Record<string, number>;
  };
  next_run: string | null;
  interval_hours: number;
}

export function useScheduledScanTrigger() {
  const autoTriggered = useRef(false);
  const [lastResult, setLastResult] = useState<AutoScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAndRun = useCallback(async (): Promise<AutoScanResult | null> => {
    if (autoTriggered.current) return null;
    autoTriggered.current = true;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('scheduled-scan', {
        body: {},
      });

      if (invokeError) {
        setError(invokeError.message || 'Scheduled scan invocation failed');
        return null;
      }

      const scanResult: AutoScanResult = {
        ran: result?.scan_performed ?? false,
        next_run: result?.schedule?.next_run ?? null,
        interval_hours: result?.schedule?.interval_hours ?? 6,
      };

      if (result?.scan_performed) {
        scanResult.link_check = result?.summary
          ? {
              total: result.summary.total,
              active: result.summary.active,
              warning: result.summary.warning,
              dead: result.summary.dead,
            }
          : undefined;

        if (result?.integrity_guard && !result.integrity_guard.error) {
          scanResult.integrity_guard = {
            scanned: result.integrity_guard.scanned,
            violations_found: result.integrity_guard.violations_found,
            auto_fixed: result.integrity_guard.auto_fixed,
            breakdown: result.integrity_guard.breakdown || {},
          };
        }
      }

      setLastResult(scanResult);
      return scanResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndRun();
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkAndRun]);

  return { lastResult, loading, error, triggerNow: checkAndRun };
}