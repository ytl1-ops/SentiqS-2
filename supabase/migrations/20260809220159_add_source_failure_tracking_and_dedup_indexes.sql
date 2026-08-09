-- Audit du 2026-08-09 ("instabilité de la collecte") : osint_sources n'avait
-- aucun suivi des échecs consécutifs (impossible de distinguer un blip
-- transitoire d'une source morte depuis des semaines) et feeds n'avait aucun
-- index sur source_url/content_hash malgré des lookups de dédup sur ces
-- colonnes à chaque insertion (déjà 3071 lignes, full scan à chaque appel).
-- CREATE INDEX non-concurrent : table encore petite (~3000 lignes), un bref
-- verrou à l'application de cette migration est acceptable.
--
-- Rollback : voir 20260809220159_add_source_failure_tracking_and_dedup_indexes.down.sql

alter table osint_sources
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_reason text;

create index if not exists idx_feeds_source_url on feeds(source_url);
create index if not exists idx_feeds_content_hash on feeds(content_hash);
