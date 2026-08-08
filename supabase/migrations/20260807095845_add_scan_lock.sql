-- Empêche deux exécutions simultanées du scan de liens (cron sentiqs-scheduled-scan
-- + déclenchement manuel check-links + auto-check client) sur les mêmes URLs.
-- Additif uniquement.
--
-- Rollback : voir 20260807095845_add_scan_lock.down.sql

alter table public.scan_schedule
  add column if not exists running boolean not null default false,
  add column if not exists running_started_at timestamptz;
