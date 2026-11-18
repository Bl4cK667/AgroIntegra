-- Módulo cotacoes: preços públicos da CONAB (tabelas GLOBAIS, sem organizationId: exceção aprovada
-- em 18/11/2026, ver CLAUDE.md) e preços locais lançados pela equipe (por organização, com RLS).
-- Parte gerada pelo Prisma (migrate diff) e parte manual (RLS).
BEGIN;

-- CreateEnum
CREATE TYPE "MarketPriceScope" AS ENUM ('STATE', 'MUNICIPALITY');

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productClass" TEXT NOT NULL,
    "scope" "MarketPriceScope" NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "ibgeCode" TEXT,
    "placeKey" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPriceImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "lastModified" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketPriceImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalPrice" (
    "organizationId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "productKey" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "place" TEXT NOT NULL,
    "observedOn" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LocalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPrice_productCode_scope_weekEnd_idx" ON "MarketPrice"("productCode", "scope", "weekEnd");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_source_scope_placeKey_productCode_weekStart_key" ON "MarketPrice"("source", "scope", "placeKey", "productCode", "weekStart");

-- CreateIndex
CREATE INDEX "MarketPriceImport_source_file_startedAt_idx" ON "MarketPriceImport"("source", "file", "startedAt");

-- CreateIndex
CREATE INDEX "LocalPrice_organizationId_productKey_observedOn_idx" ON "LocalPrice"("organizationId", "productKey", "observedOn");

-- CreateIndex
CREATE INDEX "LocalPrice_organizationId_idx" ON "LocalPrice"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalPrice_id_organizationId_key" ON "LocalPrice"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "LocalPrice" ADD CONSTRAINT "LocalPrice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalPrice" ADD CONSTRAINT "LocalPrice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (defesa em profundidade; a API conecta como dona das tabelas).
-- LocalPrice: mesmo padrão das tabelas por organização (20261118091000).
-- MarketPrice: preço público, leitura liberada para usuários autenticados; escrita só pela API.
-- MarketPriceImport: registro interno da importação, sem acesso pelos papéis do Supabase.
ALTER TABLE public."LocalPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketPriceImport" ENABLE ROW LEVEL SECURITY;

DO $body$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['LocalPrice', 'MarketPrice', 'MarketPriceImport'] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY organization_read ON public."LocalPrice" FOR SELECT TO authenticated
      USING (app_private.has_organization_access("organizationId"));
    CREATE POLICY public_read ON public."MarketPrice" FOR SELECT TO authenticated USING (true);
  END IF;
END;
$body$;

COMMIT;
