-- Rollback de 20260807095845_add_scan_lock.
alter table public.scan_schedule
  drop column if exists running,
  drop column if exists running_started_at;
