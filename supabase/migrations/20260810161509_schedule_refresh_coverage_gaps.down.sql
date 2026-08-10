-- Rollback de 20260810161509_schedule_refresh_coverage_gaps.
select cron.unschedule('sentiqs-refresh-coverage-gaps');
