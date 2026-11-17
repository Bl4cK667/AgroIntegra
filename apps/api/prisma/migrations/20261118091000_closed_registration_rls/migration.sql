-- RLS for Supabase Data API. NestJS remains the only application data interface.
-- No browser role receives grants on internal tables (including User.passwordHash/Invitation.tokenHash).
-- SQL-owner/BYPASSRLS connections must remain server-only; the API additionally enforces organization scope.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

CREATE FUNCTION app_private.has_organization_access(target_organization_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."OrganizationMembership" m
    JOIN public."User" u ON u.id = m."userId"
    JOIN public."Organization" o ON o.id = m."organizationId"
    WHERE m."organizationId" = target_organization_id
      AND m.active AND u.active AND o.active
      AND u."authUserId" = COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
      )
  );
$$;
REVOKE ALL ON FUNCTION app_private.has_organization_access(text) FROM PUBLIC;

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Producer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Visit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VisitPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Delivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- Local PostgreSQL does not have Supabase API roles. Keep this migration portable without
-- creating privileged roles or modifying Supabase-managed schemas/roles.
DO $body$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User','Organization','OrganizationMembership','Invitation','Producer','Property','Visit','VisitPhoto','ServiceRequest','Program','Enrollment','Delivery','Notification','AuditLog'] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA app_private TO authenticated;
    GRANT EXECUTE ON FUNCTION app_private.has_organization_access(text) TO authenticated;
    -- Defense in depth for organization-owned rows; no SELECT grants are issued here.
    FOREACH table_name IN ARRAY ARRAY['Producer','Property','Visit','VisitPhoto','ServiceRequest','Program','Enrollment','Delivery'] LOOP
      EXECUTE format('CREATE POLICY organization_read ON public.%I FOR SELECT TO authenticated USING (app_private.has_organization_access("organizationId"))', table_name);
    END LOOP;
    CREATE POLICY organization_read ON public."Organization" FOR SELECT TO authenticated
      USING (app_private.has_organization_access(id));
    -- Identity, invitations, audit, notifications remain API-only and default-deny.
    -- No INSERT/UPDATE/DELETE policy is granted to browser roles on any table.
  END IF;
END;
$body$;
COMMIT;
