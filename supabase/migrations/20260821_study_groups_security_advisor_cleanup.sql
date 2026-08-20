-- Fix security-advisor search_path warnings for permission helper functions.
-- Password protection settings are intentionally unchanged.

ALTER FUNCTION private.default_study_group_permissions()
  SET search_path = pg_catalog, public, auth;

ALTER FUNCTION private.normalize_study_group_permissions(jsonb)
  SET search_path = pg_catalog, public, auth;
