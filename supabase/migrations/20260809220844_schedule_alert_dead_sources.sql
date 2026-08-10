-- Audit du 2026-08-09 : planifie alert-dead-sources toutes les heures, sur
-- le même modèle que les autres cron jobs SentiqS (extensions.http, clé anon
-- déjà utilisée par sentiqs-rss-poll/sentiqs-batch-verify/sentiqs-scheduled-scan).
--
-- Rollback : voir 20260809220844_schedule_alert_dead_sources.down.sql

select cron.schedule(
  'sentiqs-alert-dead-sources',
  '0 * * * *',
  $$
  select extensions.http((
    'POST',
    'https://yttctytqjtmaiheegqky.supabase.co/functions/v1/alert-dead-sources',
    ARRAY[extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dGN0eXRxanRtYWloZWVncWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTc1ODMsImV4cCI6MjEwMDY3MzU4M30.IPLiC67JF6df_d0fR1fV4HMGY4iI6M8NjFFgiNHBI8M'), extensions.http_header('Content-Type','application/json')],
    'application/json',
    '{}'
  )::extensions.http_request);
  $$
);
