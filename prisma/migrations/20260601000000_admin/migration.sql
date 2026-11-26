-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "EstadoGestoria" AS ENUM ('PENDIENTE', 'ACTIVA', 'SUSPENDIDA');

-- AlterEnum
ALTER TYPE "EstadoEmpresa" ADD VALUE 'SUSPENDIDA';

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "AuditoriaEvento" ADD COLUMN     "impersonadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "motivoSuspension" TEXT;

-- AlterTable
ALTER TABLE "Gestoria" ADD COLUMN     "estado" "EstadoGestoria" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "motivoSuspension" TEXT;

-- AlterTable
ALTER TABLE "Sesion" ADD COLUMN     "impersonadoPorId" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "totpVerificadoEn" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA',
ADD COLUMN     "motivoSuspension" TEXT,
ADD COLUMN     "suspendidoEn" TIMESTAMP(3),
ADD COLUMN     "ultimoAcceso" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TotpAdmin" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "secretoCifrado" TEXT NOT NULL,
    "activado" BOOLEAN NOT NULL DEFAULT false,
    "ultimoPaso" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotpAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoRespaldoAdmin" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "usadoEn" TIMESTAMP(3),

    CONSTRAINT "CodigoRespaldoAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "proposito" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "UsoVision" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "proveedor" TEXT NOT NULL,
    "modelo" TEXT,
    "entrada" INTEGER NOT NULL DEFAULT 0,
    "salida" INTEGER NOT NULL DEFAULT 0,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsoVision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TotpAdmin_usuarioId_key" ON "TotpAdmin"("usuarioId");

-- CreateIndex
CREATE INDEX "CodigoRespaldoAdmin_usuarioId_idx" ON "CodigoRespaldoAdmin"("usuarioId");

-- CreateIndex
CREATE INDEX "CodigoEmail_usuarioId_proposito_idx" ON "CodigoEmail"("usuarioId", "proposito");

-- CreateIndex
CREATE INDEX "UsoVision_createdAt_idx" ON "UsoVision"("createdAt");

-- CreateIndex
CREATE INDEX "UsoVision_empresaId_createdAt_idx" ON "UsoVision"("empresaId", "createdAt");

-- AddForeignKey
ALTER TABLE "TotpAdmin" ADD CONSTRAINT "TotpAdmin_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoRespaldoAdmin" ADD CONSTRAINT "CodigoRespaldoAdmin_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoEmail" ADD CONSTRAINT "CodigoEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Gestorías anteriores a la administración siguen activas; las nuevas entran como PENDIENTE.
UPDATE "Gestoria" SET "estado" = 'ACTIVA';
