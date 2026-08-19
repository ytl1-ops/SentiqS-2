import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({
          error: "MISSING_VAPID_KEYS",
          detail: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY non configurées sur ce projet Supabase (Project Settings → Edge Functions → Secrets).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    webpush.setVapidDetails("mailto:contact@sentiqs.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { title, body, url } = await req.json();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: subs, error: fetchError } = await supabase.from("push_subscriptions").select("*");
    if (fetchError) throw fetchError;

    const payload = JSON.stringify({ title, body, url: url || "/dashboard/alerts" });

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    for (const sub of subs || []) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Abonnement expiré/révoqué côté navigateur — on le supprime
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          errors.push((err as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, removed, total: (subs || []).length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
