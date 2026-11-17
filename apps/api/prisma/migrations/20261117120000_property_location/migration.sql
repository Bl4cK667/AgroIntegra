-- AlterTable: localização digitada da propriedade (todos os campos opcionais).
ALTER TABLE "Property" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" CHAR(2),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
