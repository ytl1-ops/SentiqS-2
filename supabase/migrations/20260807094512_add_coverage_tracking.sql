-- Sépare la qualité de couverture des données du niveau de risque calculé,
-- pour ne plus jamais présenter "aucune donnée trouvée" comme "situation normale".
-- Additif uniquement.
--
-- Rollback : voir 20260807094512_add_coverage_tracking.down.sql

alter table public.country_posture_state
  add column if not exists coverage_status text not null default 'collecte_en_cours'
    check (coverage_status = any (array['bonne_couverture','couverture_partielle','donnees_anciennes','aucune_donnee_recente','source_indisponible','collecte_en_cours'])),
  add column if not exists last_collection_at timestamptz,
  add column if not exists sources_consulted_count integer not null default 0;

create index if not exists country_posture_state_coverage_idx on public.country_posture_state(coverage_status);
