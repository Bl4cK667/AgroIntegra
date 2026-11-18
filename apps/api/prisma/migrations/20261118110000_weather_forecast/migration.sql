-- Módulo clima: última previsão válida por organização, fonte e local (cache + reserva).
-- Parte gerada pelo Prisma (migrate diff) e parte manual (RLS), no padrão de 20261118091000.
BEGIN;

-- CreateEnum
CREATE TYPE "WeatherSource" AS ENUM ('INMET', 'OPEN_METEO');

-- CreateTable
CREATE TABLE "WeatherForecast" (
    "organizationId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "source" "WeatherSource" NOT NULL,
    "locationKey" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WeatherForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherForecast_organizationId_idx" ON "WeatherForecast"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherForecast_organizationId_source_locationKey_key" ON "WeatherForecast"("organizationId", "source", "locationKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherForecast_id_organizationId_key" ON "WeatherForecast"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "WeatherForecast" ADD CONSTRAINT "WeatherForecast_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (defesa em profundidade; a API conecta como dona da tabela e usa o escopo do PrismaService).
ALTER TABLE public."WeatherForecast" ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  REVOKE ALL PRIVILEGES ON TABLE public."WeatherForecast" FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public."WeatherForecast" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public."WeatherForecast" FROM authenticated;
    CREATE POLICY organization_read ON public."WeatherForecast" FOR SELECT TO authenticated
      USING (app_private.has_organization_access("organizationId"));
  END IF;
END;
$body$;

COMMIT;
