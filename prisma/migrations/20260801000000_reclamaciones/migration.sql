-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'ENVIADA', 'RESUELTA', 'SIN_JUSTIFICANTE', 'OMITIDA', 'SIN_CANAL');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "ultimoMensajeWhatsappEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SolicitudJustificante" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "envios" INTEGER NOT NULL DEFAULT 0,
    "ultimoEnvioEn" TIMESTAMP(3),
    "via" TEXT,
    "creadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudJustificante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudJustificante_movimientoId_key" ON "SolicitudJustificante"("movimientoId");

-- CreateIndex
CREATE INDEX "SolicitudJustificante_empresaId_estado_idx" ON "SolicitudJustificante"("empresaId", "estado");

-- AddForeignKey
ALTER TABLE "SolicitudJustificante" ADD CONSTRAINT "SolicitudJustificante_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudJustificante" ADD CONSTRAINT "SolicitudJustificante_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "MovimientoBancario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

