// ============================================================
// SentiqS — Strategic Reports & Data Flows TypeScript Types
// Directive Anti-Hallucination : aucune donnée fictive, uniquement
// des structures vides prêtes à être connectées aux sources réelles.
// ============================================================

// ─── Strategic Reports ───────────────────────────────────────

export type StrategicReportType = 'sir' | 'sitrep' | 'threat_assessment' | 'logistics_audit';
export type StrategicReportStatus = 'draft' | 'generating' | 'ready' | 'archived';
export type ExportFormat = 'pdf' | 'word' | 'excel' | 'ppt' | 'csv' | 'image' | 'ical' | 'sms_text' | 'whatsapp_text';

export interface SIRPayload {
  incident_nature: string;
  gps_lat: number | null;
  gps_lng: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  instructions: string;
  affected_area: string;
  casualties: number | null;
  response_status: string;
}

export interface SITREPPayload {
  bilan_24h: string;
  road_axes: Array<{ name: string; status: 'open' | 'degraded' | 'closed'; details: string }>;
  airports: Array<{ code: string; name: string; status: 'normal' | 'limited' | 'closed'; details: string }>;
  weather: { conditions: string; temperature: number | null; updated_at: string };
  key_incidents: Array<{ time: string; description: string; location: string }>;
  recommendations: string;
}

export interface ThreatAssessmentPayload {
  political_risk: { level: string; summary: string; triggers: string[] };
  health_risk: { level: string; summary: string; active_outbreaks: string[] };
  security_risk: { level: string; summary: string; active_groups: string[] };
  actor_mapping: Array<{ name: string; type: string; influence: string; stance: string }>;
  forecast_30d: string;
}

export interface LogisticsAuditPayload {
  base_security: { perimeter: string; access_control: string; emergency_exits: string; score: number };
  route_checkpoints: Array<{ name: string; gps_lat: number | null; gps_lng: number | null; risk: string; notes: string }>;
  site_safety: { fire_protection: string; medical_capability: string; comms_redundancy: string };
  supply_chain: { fuel_status: string; water_status: string; food_stock_days: number };
  recommendations: string[];
}

export type StrategicReportPayload = SIRPayload | SITREPPayload | ThreatAssessmentPayload | LogisticsAuditPayload;

export interface StrategicReport {
  id: number;
  report_type: StrategicReportType;
  title: string;
  title_en: string | null;
  status: StrategicReportStatus;
  payload: StrategicReportPayload;
  region: string | null;
  countries: string[];
  author: string | null;
  author_role: string | null;
  org_id: string | null;
  generated_formats: ExportFormat[];
  branding_id: number | null;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
}

// ─── OSINT Sources ───────────────────────────────────────────

export type OsinSourceType = 'rss' | 'social_media' | 'local_media' | 'api_agency' | 'manual';

export interface OsinSource {
  id: number;
  source_type: OsinSourceType;
  source_name: string;
  source_url: string | null;
  country: string | null;
  region: string | null;
  last_fetched_at: string | null;
  fetch_interval_minutes: number;
  is_active: boolean;
  detection_keywords: string[];
  detection_patterns: string[];
  total_articles_fetched: number;
  alerts_triggered: number;
  reliability_score: number;
  nb_articles_last_check: number | null;
  rss_validated: boolean;
  created_at: string;
  updated_at: string;
}

// ─── RSS Register Types ──────────────────────────────────────

export interface RssRegisterRequest {
  mode: 'rss_register';
  source_name: string;
  source_url: string;
  country: string;
  detection_keywords?: string[];
  fetch_interval_minutes?: number;
  osint_source_id?: number;
}

export interface RssRegisterResponse {
  success: boolean;
  mode: 'rss_register';
  osint_source_id: number | null;
  rss: {
    http_status: number | null;
    total_articles_in_feed: number;
    matched_articles: number;
    articles_inserted: number;
    alerts_detected: number;
    sample_titles: string[];
  };
  message: string;
  reason?: string;
  errors?: string[];
}

export interface DiscoverFeedRequest {
  mode: 'discover';
  website_url: string;
}

export interface DiscoverFeedResponse {
  success: boolean;
  discovered_url?: string;
  discovery_method?: 'html_link_tag' | 'common_path';
  reason?: string;
  message?: string;
  errors?: string[];
}

// ─── Logistics Status ────────────────────────────────────────

export type LogisticsEntityType = 'port' | 'airport' | 'border_crossing' | 'road_axis' | 'checkpoint' | 'base_vie' | 'warehouse';
export type OperationalStatus = 'normal' | 'degraded' | 'closed' | 'unknown';
export type RoadViability = 'good' | 'moderate' | 'poor' | 'impassable';

export interface LogisticsStatus {
  id: number;
  country: string;
  entity_type: LogisticsEntityType;
  entity_name: string;
  operational_status: OperationalStatus;
  status_details: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  road_viability: RoadViability | null;
  weather_conditions: string | null;
  weather_updated_at: string | null;
  last_report_at: string | null;
  reported_by: string | null;
  source_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

// ─── GIS Layers ──────────────────────────────────────────────

export type GisLayerType = 'critical_infrastructure' | 'hospital' | 'red_zone' | 'embassy' | 'evacuation_route' | 'military_zone' | 'custom';
export type GisRiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface GisLayer {
  id: number;
  layer_type: GisLayerType;
  layer_name: string;
  country: string;
  region: string | null;
  geojson: Record<string, unknown> | null;
  label: string | null;
  description: string | null;
  risk_level: GisRiskLevel | null;
  facility_type: string | null;
  capacity: number | null;
  contact_info: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Org Branding (White Label) ──────────────────────────────

export interface OrgBrandingTemplateVars {
  ORG_NAME: string;
  ORG_SHORT_NAME: string;
  ORG_LOGO_URL: string;
  ORG_COLOR_PRIMARY: string;
  ORG_COLOR_SECONDARY: string;
  ORG_FONT_HEADING: string;
  ORG_FONT_BODY: string;
  ORG_SIGNATURE: string;
  ORG_CONFIDENTIALITY: string;
  ORG_FOOTER: string;
  ORG_WEBSITE: string;
}

export interface OrgBranding {
  id: number;
  org_name: string;
  org_slug: string;
  template_vars: OrgBrandingTemplateVars;
  word_template_url: string | null;
  ppt_template_url: string | null;
  excel_template_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Share Channels ──────────────────────────────────────────

export type ShareChannelType = 'email' | 'whatsapp' | 'sms' | 'google_drive' | 'sharepoint' | 'image_capture';

export interface ShareChannelConfig {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  from_address?: string;
  phone_number?: string;
  api_key?: string;
  template_namespace?: string;
  provider?: string;
  folder_id?: string;
  service_account?: string;
  site_url?: string;
  folder_path?: string;
  client_id?: string;
}

export interface ShareChannel {
  id: number;
  org_id: string | null;
  channel_type: ShareChannelType;
  channel_label: string | null;
  config: ShareChannelConfig;
  is_active: boolean;
  daily_quota: number | null;
  used_today: number;
  created_at: string;
  updated_at: string;
}

// ─── Share Logs (Audit Trail) ────────────────────────────────

export type ShareDocumentType = 'strategic_report' | 'alert' | 'feed' | 'correlation' | 'agenda_event' | 'screenshot';
export type ShareStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface ShareLog {
  id: number;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  user_org: string | null;
  document_type: ShareDocumentType;
  document_id: string | null;
  document_title: string | null;
  export_format: ExportFormat | null;
  channel: ShareChannelType;
  recipient: string | null;
  status: ShareStatus;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  completed_at: string | null;
}

// ─── Share Router State ──────────────────────────────────────

export interface ShareRouterState {
  open: boolean;
  step: 'document' | 'format' | 'channel' | 'confirm';
  documentType: ShareDocumentType | null;
  documentId: string | null;
  documentTitle: string | null;
  exportFormat: ExportFormat | null;
  channel: ShareChannelType | null;
  recipient: string | null;
  message: string | null;
  identity: { name: string; role: string; org: string };
}

// ─── Data Flow Aggregation ───────────────────────────────────

export interface DataFlowStats {
  osint: { total_sources: number; active_sources: number; articles_24h: number; alerts_triggered: number };
  logistics: { total_entities: number; degraded: number; closed: number; last_updated: string | null };
  gis: { total_layers: number; active_layers: number; red_zones: number; critical_infra: number };
}

// ─── Report Generation Request ───────────────────────────────

export interface ReportGenerationRequest {
  report_type: StrategicReportType;
  title: string;
  region?: string;
  countries?: string[];
  branding_id?: number;
  target_formats: ExportFormat[];
}

export interface ReportGenerationResult {
  report_id: number;
  formats_generated: ExportFormat[];
  download_urls: Record<string, string>;
}

// ─── Share Dispatch Request ──────────────────────────────────

export interface ShareDispatchRequest {
  document_type: ShareDocumentType;
  document_id: string | null;
  document_title: string | null;
  export_format: ExportFormat | null;
  channel: ShareChannelType;
  recipient: string | null;
  message: string | null;
  user_name: string;
  user_role: string;
  user_org: string;
}