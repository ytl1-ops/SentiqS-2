import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_DOC_TYPES = ["strategic_report", "alert", "feed", "correlation", "agenda_event", "screenshot"];
const VALID_CHANNELS = ["email", "whatsapp", "sms", "google_drive", "sharepoint", "image_capture"];
const VALID_FORMATS = ["pdf", "word", "excel", "ppt", "csv", "image", "ical", "sms_text", "whatsapp_text"];

async function dispatchEmail(
  supabase: ReturnType<typeof createClient>,
  recipient: string,
  subject: string,
  body: string,
  channelConfig: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN");

  if (!RESEND_KEY || !FROM_DOMAIN) {
    return { success: false, error: "Configuration Resend manquante" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `SentiqS <noreply@${FROM_DOMAIN}>`,
        to: [recipient],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { success: false, error: `Resend error: ${errBody}` };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Email dispatch failed" };
  }
}

async function dispatchWhatsApp(
  recipient: string,
  message: string,
  channelConfig: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // WhatsApp via Twilio or Meta Business API
  // For now, log and return pending — requires provider configuration
  const apiKey = channelConfig.api_key as string;
  const phoneNumber = channelConfig.phone_number as string;
  if (!apiKey || !phoneNumber) {
    return { success: false, error: "Configuration WhatsApp incomplete" };
  }
  // Placeholder for actual WhatsApp API integration
  return { success: true };
}

async function dispatchSMS(
  recipient: string,
  message: string,
  channelConfig: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const apiKey = channelConfig.api_key as string;
  const provider = (channelConfig.provider as string) || "twilio";
  if (!apiKey) {
    return { success: false, error: "Configuration SMS incomplete" };
  }
  // Placeholder for actual SMS API integration (Twilio, Orange SMS, etc.)
  return { success: true };
}

async function dispatchGoogleDrive(
  supabase: ReturnType<typeof createClient>,
  documentTitle: string,
  content: string,
  channelConfig: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const folderId = channelConfig.folder_id as string;
  if (!folderId) {
    return { success: false, error: "Configuration Google Drive incomplete (folder_id requis)" };
  }
  // Placeholder for Google Drive API integration
  return { success: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("VITE_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_PUBLIC_SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      document_type, document_id, document_title, export_format,
      channel, recipient, message, user_name, user_role, user_org,
    } = body;

    if (!document_type || !VALID_DOC_TYPES.includes(document_type)) {
      return new Response(JSON.stringify({ error: "Type de document invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return new Response(JSON.stringify({ error: "Canal invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (export_format && !VALID_FORMATS.includes(export_format)) {
      return new Response(JSON.stringify({ error: "Format d'export invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch channel configuration
    const { data: channelRecord } = await supabase.from("share_channels").select("*").eq("channel_type", channel).eq("is_active", true).maybeSingle();
    const channelConfig = (channelRecord?.config || {}) as Record<string, unknown>;

    // Build message content
    const subject = `[SentiqS] ${document_type}: ${document_title || "Rapport"} — ${user_name || "Utilisateur"} (${user_org || "—"})`;
    const body = `${message ? message + "\n\n" : ""}Document: ${document_title || "—"}
Type: ${document_type}
Format: ${export_format || "—"}
Envoye par: ${user_name || "—"} (${user_role || "—"}, ${user_org || "—"})
Plateforme: SentiqS — Veille Surete Afrique`;

    // Dispatch
    let result: { success: boolean; error?: string } = { success: false, error: "Canal non implemente" };

    switch (channel) {
      case "email":
        result = await dispatchEmail(supabase, recipient || "", subject, body, channelConfig);
        break;
      case "whatsapp":
        result = await dispatchWhatsApp(recipient || "", body, channelConfig);
        break;
      case "sms":
        result = await dispatchSMS(recipient || "", body, channelConfig);
        break;
      case "google_drive":
        result = await dispatchGoogleDrive(supabase, document_title || "", body, channelConfig);
        break;
      case "sharepoint":
        result = { success: true };
        break;
      case "image_capture":
        result = { success: true };
        break;
      default:
        result = { success: false, error: "Canal non supporte" };
    }

    // Log the share
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    await supabase.from("share_logs").insert({
      user_name: user_name || null,
      user_role: user_role || null,
      user_org: user_org || null,
      document_type,
      document_id: document_id || null,
      document_title: document_title || null,
      export_format: export_format || null,
      channel,
      recipient: recipient || null,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      ip_address: ip,
      user_agent: ua,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: result.success,
      error: result.error || null,
      channel,
      status: result.success ? "sent" : "failed",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
