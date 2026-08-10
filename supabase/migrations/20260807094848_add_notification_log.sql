-- Empêche l'envoi répété de la même notification (push) — cooldown par dedup_key.
-- Additif uniquement.
--
-- Rollback : voir 20260807101253_add_notification_log.down.sql

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  dedup_key text not null,
  channel text not null default 'push',
  country_code text,
  severity text,
  alert_id uuid references public.alerts(id) on delete set null,
  sent_at timestamptz not null default now(),
  payload jsonb not null default '{}'
);

create index if not exists notification_log_dedup_key_idx on public.notification_log(dedup_key, sent_at desc);

alter table public.notification_log enable row level security;

create policy "admins manage notification_log" on public.notification_log
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read notification_log" on public.notification_log
  for select to authenticated using (true);
