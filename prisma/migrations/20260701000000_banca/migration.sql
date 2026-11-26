-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('CSV', 'N43', 'OPEN_BANKING');

-- CreateEnum
CREATE TYPE "EstadoConciliacion" AS ENUM ('CONFIRMADA');

-- CreateTable
CREATE TABLE "MovimientoBancario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "origen" "OrigenMovimiento" NOT NULL,
    "importadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoBancario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conciliacion" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "puntuacion" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoConciliacion" NOT NULL DEFAULT 'CONFIRMADA',
    "motivos" JSONB NOT NULL,
    "decididoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conciliacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConexionBancaria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "expiraEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConexionBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoBancario_empresaId_fecha_idx" ON "MovimientoBancario"("empresaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoBancario_empresaId_idExterno_key" ON "MovimientoBancario"("empresaId", "idExterno");

-- CreateIndex
CREATE UNIQUE INDEX "Conciliacion_movimientoId_key" ON "Conciliacion"("movimientoId");

-- CreateIndex
CREATE UNIQUE INDEX "Conciliacion_documentoId_key" ON "Conciliacion"("documentoId");

-- CreateIndex
CREATE INDEX "ConexionBancaria_empresaId_idx" ON "ConexionBancaria"("empresaId");

-- AddForeignKey
ALTER TABLE "MovimientoBancario" ADD CONSTRAINT "MovimientoBancario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conciliacion" ADD CONSTRAINT "Conciliacion_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "MovimientoBancario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conciliacion" ADD CONSTRAINT "Conciliacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConexionBancaria" ADD CONSTRAINT "ConexionBancaria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

