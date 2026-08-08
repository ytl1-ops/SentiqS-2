-- Migration: add_evidence_traceability
-- Objectif : permettre de relier chaque alerte à ses feeds justificatifs (osint_sources),
-- et de persister le détail (facteurs, preuves, confiance, statut) de chaque calcul de
-- score pays. Corrige le constat d'audit "score/alerte sans preuve traçable".
-- Additif uniquement : aucune colonne/table existante modifiée ou supprimée.
--
-- Rollback (non appliqué automatiquement — voir fichier .down.sql du même nom) :
--   drop table if exists public.score_calculations;
--   drop table if exists public.alert_evidence;
--   alter table public.feeds drop column if exists osint_source_id;

-- 1. Lien feeds -> osint_sources (traçabilité de la source d'origine)
alter table public.feeds
  add column if not exists osint_source_id bigint references public.osint_sources(id) on delete set null;

create index if not exists feeds_osint_source_id_idx on public.feeds(osint_source_id);

-- Backfill best-effort : correspondance exacte (insensible à la casse) entre feeds.source
-- et osint_sources.source_name. Les correspondances ambiguës ou absentes restent NULL —
-- on ne devine jamais une provenance non certaine.
update public.feeds f
set osint_source_id = matched.id
from (
  select distinct on (lower(source_name)) id, lower(source_name) as norm_name
  from public.osint_sources
  order by lower(source_name), id
) matched
where f.osint_source_id is null
  and lower(f.source) = matched.norm_name;

-- 2. Table de jonction alert <-> feeds justificatifs
create table if not exists public.alert_evidence (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  feed_id uuid not null references public.feeds(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  unique (alert_id, feed_id)
);

create index if not exists alert_evidence_alert_id_idx on public.alert_evidence(alert_id);
create index if not exists alert_evidence_feed_id_idx on public.alert_evidence(feed_id);

alter table public.alert_evidence enable row level security;

create policy "admins manage alert_evidence" on public.alert_evidence
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read alert_evidence" on public.alert_evidence
  for select to authenticated using (true);

create policy "authenticated write alert_evidence" on public.alert_evidence
  for insert to authenticated with check (true);

-- 3. Traçabilité des calculs de score pays (justification, version de règle, statut)
create table if not exists public.score_calculations (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  country_name text not null,
  rule_version text not null,
  computed_at timestamptz not null default now(),
  score numeric not null,
  level text not null check (level = any (array['rouge','orange','jaune','vert'])),
  feed_ids uuid[] not null default '{}',
  alert_ids uuid[] not null default '{}',
  factors jsonb not null default '{}',
  confidence numeric check (confidence >= 0 and confidence <= 1),
  explanation text,
  status text not null default 'provisoire' check (status = any (array['provisoire','valide','conteste','expire']))
);

create index if not exists score_calculations_country_code_idx on public.score_calculations(country_code, computed_at desc);

alter table public.score_calculations enable row level security;

create policy "admins manage score_calculations" on public.score_calculations
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read score_calculations" on public.score_calculations
  for select to authenticated using (true);
