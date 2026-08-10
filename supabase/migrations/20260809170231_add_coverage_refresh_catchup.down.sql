-- Rollback de 20260809170231_add_coverage_refresh_catchup (+ le correctif
-- 20260809170244_fix_coverage_refresh_log_result_values).
drop table if exists public.coverage_refresh_log;
drop table if exists public.coverage_refresh_lock;
