-- Corrige la cause racine du trou de couverture constaté le 2026-08-10
-- (décès du colonel Fofié / FACI jamais remonté pour la Côte d'Ivoire) :
-- refresh-coverage-gaps n'était JAMAIS planifiée, uniquement déclenchable
-- à la demande via le skill Claude Code refresh-news-coverage. Sans
-- session humaine pour la relancer chaque jour, aucun des 54 pays n'était
-- plus jamais rattrapé automatiquement. Ce cron rend le rattrapage
-- indépendant de toute intervention manuelle, quotidienne ou non.
--
-- net.http_post (pg_net) est "fire-and-forget" côté appelant : le job cron
-- rend la main immédiatement, la requête HTTP s'exécute en tâche de fond
-- avec jusqu'à 150s pour aboutir (refresh-coverage-gaps peut légitimement
-- prendre jusqu'à ~140s en interne, cf. son propre commentaire de tête) —
-- contrairement à extensions.http() (utilisé par les autres cron jobs
-- SentiqS), qui bloquerait la transaction cron le temps de la réponse.
-- La fonction persiste tout elle-même en base ; la réponse HTTP au cron
-- n'a pas besoin d'être relue.
--
-- Cadence 30 min, décalée de 5 min par rapport à sentiqs-rss-poll pour ne
-- pas cumuler deux pics de charge pg_net au même instant. Avec 5 pays
-- traités par run et 54 pays au total, chaque pays repasse en tête de
-- rotation au pire après ~11 exécutions (~5h30).
--
-- Rollback : voir 20260810161509_schedule_refresh_coverage_gaps.down.sql
select cron.schedule(
  'sentiqs-refresh-coverage-gaps',
  '5,35 * * * *',
  $$
  select net.http_post(
    url := 'https://yttctytqjtmaiheegqky.supabase.co/functions/v1/refresh-coverage-gaps',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dGN0eXRxanRtYWloZWVncWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTc1ODMsImV4cCI6MjEwMDY3MzU4M30.IPLiC67JF6df_d0fR1fV4HMGY4iI6M8NjFFgiNHBI8M',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
