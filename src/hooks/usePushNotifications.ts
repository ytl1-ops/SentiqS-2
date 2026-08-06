import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Clé publique VAPID — non sensible par construction du protocole Web Push
// (c'est l'"applicationServerKey", exposée côté client dans toute
// implémentation). La clé privée correspondante ne vit que côté serveur
// (secret Edge Function VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY = 'BBJPf_wHkwSEP0eZBsEeaRVOqJChqy9PCi_YwI8zGZPrqvFqVJc7cSR6CI4EpMX_mr6t0ME9ALh7o36lVUUAGck';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSupportState = 'unsupported' | 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushSupportState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const refreshStatus = useCallback(async () => {
    if (!supported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushSupportState);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, [supported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      setError('Les notifications push ne sont pas prises en charge par ce navigateur.');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushSupportState);
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Notifications refusées — activez-les dans les réglages du navigateur.' : 'Permission non accordée.');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON();
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from('push_subscriptions').upsert({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
        user_id: user?.id ?? null,
        user_agent: navigator.userAgent,
      }, { onConflict: 'endpoint' });

      if (insertError) throw insertError;

      setIsSubscribed(true);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, loading, error, subscribe, unsubscribe };
}
