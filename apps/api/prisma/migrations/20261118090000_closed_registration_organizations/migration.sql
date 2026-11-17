-- Reviewed source migration only. Apply to an isolated staging database first.
BEGIN;

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_producerId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_producerId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_requestId_fkey";

-- DropForeignKey
ALTER TABLE "VisitPhoto" DROP CONSTRAINT "VisitPhoto_visitId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequest" DROP CONSTRAINT "ServiceRequest_producerId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequest" DROP CONSTRAINT "ServiceRequest_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_programId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_producerId_fkey";

-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_programId_fkey";

-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_producerId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authUserId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "VisitPhoto" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_active_idx" ON "OrganizationMembership"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_createdAt_idx" ON "Invitation"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_id_organizationId_key" ON "Notification"("id", "organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_id_organizationId_key" ON "AuditLog"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Producer_organizationId_idx" ON "Producer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_id_organizationId_key" ON "Producer"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_id_organizationId_key" ON "Property"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Visit_organizationId_idx" ON "Visit"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_id_organizationId_key" ON "Visit"("id", "organizationId");

-- CreateIndex
CREATE INDEX "VisitPhoto_organizationId_idx" ON "VisitPhoto"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPhoto_id_organizationId_key" ON "VisitPhoto"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_idx" ON "ServiceRequest"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_id_organizationId_key" ON "ServiceRequest"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Program_organizationId_idx" ON "Program"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_id_organizationId_key" ON "Program"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Enrollment_organizationId_idx" ON "Enrollment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_id_organizationId_key" ON "Enrollment"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Delivery_organizationId_idx" ON "Delivery"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_id_organizationId_key" ON "Delivery"("id", "organizationId");

-- Preserve the existing single-team installation. No accounts or demo data are created.
INSERT INTO "Organization" ("id", "name", "active", "createdAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'AgroIntegra', true, CURRENT_TIMESTAMP);
INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "role", "active", "createdAt")
SELECT gen_random_uuid()::text, "id", '00000000-0000-4000-8000-000000000001', "role", "active", CURRENT_TIMESTAMP
FROM "User";
UPDATE "AuditLog" SET "organizationId" = '00000000-0000-4000-8000-000000000001';

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producer" ADD CONSTRAINT "Producer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_producerId_organizationId_fkey" FOREIGN KEY ("producerId", "organizationId") REFERENCES "Producer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_producerId_organizationId_fkey" FOREIGN KEY ("producerId", "organizationId") REFERENCES "Producer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_requestId_organizationId_fkey" FOREIGN KEY ("requestId", "organizationId") REFERENCES "ServiceRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_visitId_organizationId_fkey" FOREIGN KEY ("visitId", "organizationId") REFERENCES "Visit"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_producerId_organizationId_fkey" FOREIGN KEY ("producerId", "organizationId") REFERENCES "Producer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programId_organizationId_fkey" FOREIGN KEY ("programId", "organizationId") REFERENCES "Program"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_producerId_organizationId_fkey" FOREIGN KEY ("producerId", "organizationId") REFERENCES "Producer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_programId_organizationId_fkey" FOREIGN KEY ("programId", "organizationId") REFERENCES "Program"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_producerId_organizationId_fkey" FOREIGN KEY ("producerId", "organizationId") REFERENCES "Producer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
