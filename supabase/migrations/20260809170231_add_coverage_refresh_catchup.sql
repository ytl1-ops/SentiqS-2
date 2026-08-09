-- Mécanisme de rattrapage de couverture (section 4 du cahier des charges d'audit) :
-- verrou dédié + journal de couverture par territoire, indépendants du verrou de
-- scan de liens (scan_schedule) qui sert un autre workload.
-- Additif uniquement.
--
-- Rollback : voir 20260809170231_add_coverage_refresh_catchup.down.sql

create table if not exists public.coverage_refresh_lock (
  id integer primary key default 1,
  running boolean not null default false,
  running_started_at timestamptz,
  last_run_at timestamptz,
  constraint coverage_refresh_lock_singleton check (id = 1)
);

insert into public.coverage_refresh_lock (id, running)
values (1, false)
on conflict (id) do nothing;

alter table public.coverage_refresh_lock enable row level security;

create policy "admins manage coverage_refresh_lock" on public.coverage_refresh_lock
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read coverage_refresh_lock" on public.coverage_refresh_lock
  for select to authenticated using (true);

create table if not exists public.coverage_refresh_log (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  country_code text not null,
  country_name text not null,
  languages_tried text[] not null default '{}',
  sources_checked integer not null default 0,
  articles_found integer not null default 0,
  articles_inserted integer not null default 0,
  result text not null check (result = any (array['couverture_ameliorée','aucun_resultat','erreur'])),
  detail text
);

create index if not exists coverage_refresh_log_country_idx on public.coverage_refresh_log(country_code, run_at desc);

alter table public.coverage_refresh_log enable row level security;

create policy "admins manage coverage_refresh_log" on public.coverage_refresh_log
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read coverage_refresh_log" on public.coverage_refresh_log
  for select to authenticated using (true);
