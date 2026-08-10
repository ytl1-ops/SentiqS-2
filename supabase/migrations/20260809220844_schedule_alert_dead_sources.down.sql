-- Rollback de 20260809220844_schedule_alert_dead_sources.
select cron.unschedule('sentiqs-alert-dead-sources');
