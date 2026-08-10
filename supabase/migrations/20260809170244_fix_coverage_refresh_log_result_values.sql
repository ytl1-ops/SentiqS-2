-- Corrige un accent introduit par erreur dans la valeur de check constraint
-- (incohérent avec le reste du schéma, qui évite les accents dans les valeurs
-- d'énumération type 'aucune_donnee_recente', 'provisoire', etc.)
--
-- Rollback : réappliquer la contrainte avec l'ancienne valeur accentuée
-- ('couverture_ameliorée') si nécessaire — non fourni séparément, cette
-- migration est elle-même le correctif d'une erreur de la précédente.
alter table public.coverage_refresh_log drop constraint if exists coverage_refresh_log_result_check;
alter table public.coverage_refresh_log
  add constraint coverage_refresh_log_result_check
  check (result = any (array['couverture_amelioree','aucun_resultat','erreur']));
