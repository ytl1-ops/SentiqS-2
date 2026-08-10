-- Rollback de la migration 20260807091554_add_evidence_traceability.
-- À exécuter manuellement (mcp Supabase apply_migration ou `supabase db execute`)
-- si la traçabilité preuve doit être retirée. Aucune donnée pré-existante
-- (feeds, alerts, osint_sources) n'est affectée — seules les additions sont retirées.

drop table if exists public.score_calculations;
drop table if exists public.alert_evidence;

drop index if exists public.feeds_osint_source_id_idx;
alter table public.feeds drop column if exists osint_source_id;
