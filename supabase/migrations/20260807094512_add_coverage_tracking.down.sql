-- Rollback de 20260807094512_add_coverage_tracking.
drop index if exists public.country_posture_state_coverage_idx;

alter table public.country_posture_state
  drop column if exists coverage_status,
  drop column if exists last_collection_at,
  drop column if exists sources_consulted_count;
