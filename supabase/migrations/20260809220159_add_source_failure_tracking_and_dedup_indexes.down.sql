-- Rollback de 20260809220159_add_source_failure_tracking_and_dedup_indexes.
drop index if exists idx_feeds_content_hash;
drop index if exists idx_feeds_source_url;

alter table osint_sources
  drop column if exists last_failure_reason,
  drop column if exists last_success_at,
  drop column if exists consecutive_failures;
