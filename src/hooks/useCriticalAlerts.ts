import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSupabaseCriticalAlerts, SupabaseAlert } from '@/hooks/useSupabaseAlerts';
import { supabase } from '@/lib/supabase';
import { playCriticalAlertSound, preheatAudioContext } from '@/utils/alertSound';

const STORAGE_KEY = 'sentiqs_seen_critical_alerts';
const MUTED_KEY = 'sentiqs_alert_sound_muted';

interface PostureCriticalRow {
  id: number;
  country_code: string;
  country_name: string;
  old_level: string;
  new_level: string;
  old_score: number;
  new_score: number;
  created_at: string;
}

// La table `alerts` (source historique du toast) reste souvent vide en
// pratique — le niveau de risque réel est calculé côté client par
// useAlertLevels à partir des flux, puis synchronisé dans posture_history
// à chaque changement effectif. On combine donc les deux sources pour que
// le popup reflète l'état réel de l'app plutôt qu'une table non alimentée.
function postureRowToAlert(row: PostureCriticalRow): SupabaseAlert {
  return {
    id: `posture-${row.id}`,
    severity: 'critical',
    title: `${row.country_name} passe en niveau CRITIQUE (score ${Number(row.new_score).toFixed(1)}/100)`,
    country: row.country_name,
    region: '',
    department: '',
    locality: '',
    timestamp: row.created_at,
    source: 'Analyse de posture SentiqS',
    category: 'Sécurité',
    status: 'active',
    impact: '',
    verification_status: 'verified',
    created_at: row.created_at,
  };
}

function usePostureCriticalAlerts() {
  const [rows, setRows] = useState<PostureCriticalRow[]>([]);

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from('posture_history')
      .select('*')
      .eq('new_level', 'rouge')
      .order('created_at', { ascending: false })
      .limit(20);
    setRows((data || []) as PostureCriticalRow[]);
  }, []);

  useEffect(() => {
    fetchRows();

    const channel = supabase
      .channel('posture-critical-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posture_history' }, () => {
        fetchRows();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  return rows;
}

function getSeenAlertIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useCriticalAlerts() {
  const { criticalAlerts: tableAlerts } = useSupabaseCriticalAlerts();
  const postureRows = usePostureCriticalAlerts();
  const [seenIds, setSeenIds] = useState<string[]>(getSeenAlertIds);
  const [showToast, setShowToast] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [latestAlert, setLatestAlert] = useState<SupabaseAlert | null>(null);

  const dbAlerts = useMemo(() => {
    const postureAlerts = postureRows.map(postureRowToAlert);
    return [...tableAlerts, ...postureAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [tableAlerts, postureRows]);

  // Garder trace des IDs précédents pour détecter les nouvelles alertes temps réel
  const prevAlertIdsRef = useRef<string[]>([]);
  const isInitialMountRef = useRef(true);

  // Préchauffer le contexte audio au premier clic utilisateur sur la page
  useEffect(() => {
    const preheat = () => {
      preheatAudioContext();
      document.removeEventListener('click', preheat);
    };
    document.addEventListener('click', preheat);
    return () => document.removeEventListener('click', preheat);
  }, []);

  const totalCount = dbAlerts.length;

  const unreadCount = useMemo(
    () => dbAlerts.filter((a) => !seenIds.includes(a.id)).length,
    [dbAlerts, seenIds],
  );

  // Réactivité temps réel : détecter les nouvelles alertes dès qu'elles arrivent via Supabase
  useEffect(() => {
    const currentIds = dbAlerts.map((a) => a.id);
    const prevIds = prevAlertIdsRef.current;

    // Détecter les alertes qui viennent d'arriver (temps réel Supabase)
    const newlyArrivedIds = currentIds.filter((id) => !prevIds.includes(id));

    if (newlyArrivedIds.length > 0 && !isInitialMountRef.current && !toastDismissed) {
      // Une ou plusieurs nouvelles alertes critiques viennent d'arriver → notifier immédiatement
      const newestAlert = dbAlerts.find((a) => a.id === newlyArrivedIds[0]) || null;
      setLatestAlert(newestAlert);
      setShowToast(true);
      if (!muted) {
        playCriticalAlertSound();
      }
    }

    // Premier montage : afficher le toast après un délai si des alertes non lues existent
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;

      if (unreadCount > 0 && !toastDismissed) {
        const newestAlert = dbAlerts[0] || null;
        setLatestAlert(newestAlert);
        const timer = setTimeout(() => {
          setShowToast(true);
          if (!muted) {
            playCriticalAlertSound();
          }
        }, 1500);
        prevAlertIdsRef.current = currentIds;
        return () => clearTimeout(timer);
      }
    }

    prevAlertIdsRef.current = currentIds;
    return undefined;
  }, [dbAlerts, unreadCount, toastDismissed, muted]);

  // Polling de secours toutes les 45 secondes (fallback si le canal Supabase lag)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentUnread = dbAlerts.filter((a) => !getSeenAlertIds().includes(a.id)).length;
      if (currentUnread > 0 && !toastDismissed) {
        setShowToast(true);
        if (!muted) {
          playCriticalAlertSound();
        }
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [dbAlerts, toastDismissed, muted]);

  const markAsSeen = useCallback(() => {
    const ids = dbAlerts.map((a) => a.id);
    const allSeen = [...new Set([...seenIds, ...ids])];
    setSeenIds(allSeen);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSeen));
    setShowToast(false);
    setToastDismissed(true);
  }, [dbAlerts, seenIds]);

  const dismissToast = useCallback(() => {
    setShowToast(false);
    setToastDismissed(true);
  }, []);

  const resetToast = useCallback(() => {
    setToastDismissed(false);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTED_KEY, String(next));
      return next;
    });
  }, []);

  return {
    totalCount,
    unreadCount,
    criticalAlerts: dbAlerts,
    latestAlert,
    markAsSeen,
    showToast,
    dismissToast,
    resetToast,
    muted,
    toggleMute,
  };
}
