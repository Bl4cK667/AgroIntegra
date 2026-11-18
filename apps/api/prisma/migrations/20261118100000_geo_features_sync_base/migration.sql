-- Módulo geo (PostGIS) + preparação para o sync offline (deletedAt/updatedAt).
-- Parte gerada pelo Prisma (prisma migrate dev --create-only) e parte manual
-- (extensão, CHECK, triggers e RLS), que o Prisma não representa no schema.
BEGIN;

-- PostGIS. Instalado no schema public, que funciona no PostgreSQL local e no Supabase.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "PropertyFeatureType" AS ENUM ('PERIMETER', 'PLOT', 'APP', 'LEGAL_RESERVE', 'HEADQUARTERS', 'IMPROVEMENT', 'WATER', 'ROAD');

-- CreateEnum
CREATE TYPE "PropertyFeatureChange" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "calculatedAreaHa" DECIMAL(14,4),
ADD COLUMN     "calculatedPerimeterM" DECIMAL(14,2),
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VisitPhoto" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PropertyFeature" (
    "organizationId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "PropertyFeatureType" NOT NULL,
    "name" TEXT,
    "geom" geometry(Geometry, 4326) NOT NULL,
    "areaHa" DECIMAL(14,4),
    "perimeterM" DECIMAL(14,2),
    "lengthM" DECIMAL(14,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFeatureVersion" (
    "organizationId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change" "PropertyFeatureChange" NOT NULL,
    "type" "PropertyFeatureType" NOT NULL,
    "name" TEXT,
    "geom" geometry(Geometry, 4326) NOT NULL,
    "areaHa" DECIMAL(14,4),
    "perimeterM" DECIMAL(14,2),
    "lengthM" DECIMAL(14,2),
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyFeatureVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyFeature_propertyId_type_idx" ON "PropertyFeature"("propertyId", "type");

-- CreateIndex
CREATE INDEX "PropertyFeature_organizationId_updatedAt_idx" ON "PropertyFeature"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "PropertyFeature_geom_idx" ON "PropertyFeature" USING GIST ("geom");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeature_id_organizationId_key" ON "PropertyFeature"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PropertyFeatureVersion_organizationId_idx" ON "PropertyFeatureVersion"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeatureVersion_featureId_version_key" ON "PropertyFeatureVersion"("featureId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeatureVersion_id_organizationId_key" ON "PropertyFeatureVersion"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Producer_organizationId_updatedAt_idx" ON "Producer"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Property_organizationId_updatedAt_idx" ON "Property"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_updatedAt_idx" ON "ServiceRequest"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Visit_organizationId_updatedAt_idx" ON "Visit"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "VisitPhoto_organizationId_updatedAt_idx" ON "VisitPhoto"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeatureVersion" ADD CONSTRAINT "PropertyFeatureVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeatureVersion" ADD CONSTRAINT "PropertyFeatureVersion_featureId_organizationId_fkey" FOREIGN KEY ("featureId", "organizationId") REFERENCES "PropertyFeature"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeatureVersion" ADD CONSTRAINT "PropertyFeatureVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Parte manual
-- ============================================================================

-- Rede de segurança: a API valida antes e devolve mensagens em português; isto garante
-- que nenhuma escrita por outro caminho grave geometria vazia, inválida ou do tipo errado.
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_geom_check" CHECK (
  NOT ST_IsEmpty(geom) AND ST_IsValid(geom) AND (
    (type IN ('PERIMETER', 'PLOT', 'APP', 'LEGAL_RESERVE') AND GeometryType(geom) = 'MULTIPOLYGON')
    OR (type = 'ROAD' AND GeometryType(geom) = 'MULTILINESTRING')
    OR (type IN ('HEADQUARTERS', 'IMPROVEMENT') AND GeometryType(geom) IN ('POINT', 'MULTIPOLYGON'))
    OR (type = 'WATER' AND GeometryType(geom) IN ('POINT', 'MULTILINESTRING', 'MULTIPOLYGON'))
  )
);

-- Antes de gravar: métricas calculadas pelo banco (nunca digitadas), versão e regras de imutabilidade.
CREATE FUNCTION app_private.property_feature_before_write() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF ST_Dimension(NEW.geom) = 2 THEN
    NEW."areaHa" := ROUND((ST_Area(NEW.geom::geography) / 10000)::numeric, 4);
    NEW."perimeterM" := ROUND(ST_Perimeter(NEW.geom::geography)::numeric, 2);
    NEW."lengthM" := NULL;
  ELSIF ST_Dimension(NEW.geom) = 1 THEN
    NEW."areaHa" := NULL;
    NEW."perimeterM" := NULL;
    NEW."lengthM" := ROUND(ST_Length(NEW.geom::geography)::numeric, 2);
  ELSE
    NEW."areaHa" := NULL;
    NEW."perimeterM" := NULL;
    NEW."lengthM" := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
  ELSE
    IF NEW."organizationId" <> OLD."organizationId" OR NEW."propertyId" <> OLD."propertyId"
       OR NEW.type <> OLD.type OR NEW."createdById" <> OLD."createdById" THEN
      RAISE EXCEPTION 'PropertyFeature: organização, propriedade, tipo e autor não podem ser alterados'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."deletedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'PropertyFeature: feição excluída não pode ser alterada'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.version := OLD.version + 1;
    NEW."updatedAt" := now() AT TIME ZONE 'UTC';
  END IF;
  RETURN NEW;
END;
$$;

-- Depois de gravar: histórico da demarcação e área calculada da propriedade (perímetro ativo).
CREATE FUNCTION app_private.property_feature_after_write() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  INSERT INTO public."PropertyFeatureVersion" (
    "organizationId", "id", "featureId", "version", "change", "type", "name", "geom",
    "areaHa", "perimeterM", "lengthM", "changedById", "createdAt"
  ) VALUES (
    NEW."organizationId", gen_random_uuid()::text, NEW.id, NEW.version,
    (CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN NEW."deletedAt" IS NOT NULL THEN 'DELETED' ELSE 'UPDATED' END)::"PropertyFeatureChange",
    NEW.type, NEW.name, NEW.geom, NEW."areaHa", NEW."perimeterM", NEW."lengthM", NEW."updatedById",
    now() AT TIME ZONE 'UTC'
  );

  IF NEW.type = 'PERIMETER' THEN
    UPDATE public."Property" p SET
      "calculatedAreaHa" = cur."areaHa",
      "calculatedPerimeterM" = cur."perimeterM",
      "updatedAt" = now() AT TIME ZONE 'UTC'
    FROM (
      SELECT
        (SELECT f."areaHa" FROM public."PropertyFeature" f
          WHERE f."propertyId" = NEW."propertyId" AND f."organizationId" = NEW."organizationId"
            AND f.type = 'PERIMETER' AND f."deletedAt" IS NULL
          ORDER BY f."updatedAt" DESC LIMIT 1) AS "areaHa",
        (SELECT f."perimeterM" FROM public."PropertyFeature" f
          WHERE f."propertyId" = NEW."propertyId" AND f."organizationId" = NEW."organizationId"
            AND f.type = 'PERIMETER' AND f."deletedAt" IS NULL
          ORDER BY f."updatedAt" DESC LIMIT 1) AS "perimeterM"
    ) cur
    WHERE p.id = NEW."propertyId" AND p."organizationId" = NEW."organizationId";
  END IF;
  RETURN NULL;
END;
$$;

-- O histórico não é reescrito. (DELETE continua possível só pela cascata da propriedade,
-- usada nos testes e no demo:reset; em produção a exclusão é lógica.)
CREATE FUNCTION app_private.property_feature_version_immutable() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PropertyFeatureVersion: o histórico da demarcação não pode ser alterado'
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE ALL ON FUNCTION app_private.property_feature_before_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.property_feature_after_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.property_feature_version_immutable() FROM PUBLIC;

CREATE TRIGGER property_feature_before_write
  BEFORE INSERT OR UPDATE ON "PropertyFeature"
  FOR EACH ROW EXECUTE FUNCTION app_private.property_feature_before_write();

CREATE TRIGGER property_feature_after_write
  AFTER INSERT OR UPDATE ON "PropertyFeature"
  FOR EACH ROW EXECUTE FUNCTION app_private.property_feature_after_write();

CREATE TRIGGER property_feature_version_immutable
  BEFORE UPDATE ON "PropertyFeatureVersion"
  FOR EACH ROW EXECUTE FUNCTION app_private.property_feature_version_immutable();

-- RLS no mesmo padrão de 20261118091000_closed_registration_rls.
ALTER TABLE public."PropertyFeature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PropertyFeatureVersion" ENABLE ROW LEVEL SECURITY;

DO $body$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['PropertyFeature', 'PropertyFeatureVersion'] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
      EXECUTE format('CREATE POLICY organization_read ON public.%I FOR SELECT TO authenticated USING (app_private.has_organization_access("organizationId"))', table_name);
    END IF;
  END LOOP;
END;
$body$;

COMMIT;
