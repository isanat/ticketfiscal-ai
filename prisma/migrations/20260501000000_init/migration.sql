-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('GESTOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoEmpresa" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('VALIDO', 'REQUIERE_REVISION', 'ILEGIBLE');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA_COMPLETA', 'FACTURA_SIMPLIFICADA', 'NO_VALIDO');

-- CreateEnum
CREATE TYPE "RevisionDocumento" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "OrigenDocumento" AS ENUM ('WEB', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Gestoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cif" TEXT,
    "ciudad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gestoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "gestoriaId" TEXT,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "whatsapp" TEXT,
    "estado" "EstadoEmpresa" NOT NULL DEFAULT 'PENDIENTE',
    "gestoriaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "estado" "EstadoDocumento" NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "ivaDeducible" BOOLEAN NOT NULL DEFAULT false,
    "emisorNombre" TEXT,
    "emisorNif" TEXT,
    "nifEmisorValido" BOOLEAN,
    "receptorNombre" TEXT,
    "receptorNif" TEXT,
    "nifReceptorValido" BOOLEAN,
    "numeroFactura" TEXT,
    "fechaEmision" DATE,
    "moneda" TEXT NOT NULL DEFAULT 'EUR',
    "baseImponible" DECIMAL(14,2) NOT NULL,
    "porcentajeIva" DECIMAL(5,2) NOT NULL,
    "cuotaIva" DECIMAL(14,2) NOT NULL,
    "irpfPorcentaje" DECIMAL(5,2) NOT NULL,
    "irpfImporte" DECIMAL(14,2) NOT NULL,
    "totalFactura" DECIMAL(14,2) NOT NULL,
    "cuentaPgc" TEXT,
    "confianza" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivoRevision" TEXT,
    "mensajeWhatsapp" TEXT,
    "imagenNombre" TEXT,
    "imagenMime" TEXT NOT NULL,
    "imagenBytes" INTEGER NOT NULL,
    "imagenHash" TEXT NOT NULL,
    "origen" "OrigenDocumento" NOT NULL DEFAULT 'WEB',
    "whatsappMensajeId" TEXT,
    "trimestre" TEXT,
    "revision" "RevisionDocumento" NOT NULL DEFAULT 'PENDIENTE',
    "revisadoEn" TIMESTAMP(3),
    "revisadoPorId" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaImpuesto" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "baseImponible" DECIMAL(14,2) NOT NULL,
    "porcentajeIva" DECIMAL(5,2) NOT NULL,
    "cuotaIva" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "LineaImpuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteUso" (
    "clave" TEXT NOT NULL,
    "contador" INTEGER NOT NULL,
    "ventanaInicio" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LimiteUso_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "AuditoriaEvento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "gestoriaId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_key" ON "Usuario"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_tokenHash_key" ON "Sesion"("tokenHash");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nif_key" ON "Empresa"("nif");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_whatsapp_key" ON "Empresa"("whatsapp");

-- CreateIndex
CREATE INDEX "Empresa_gestoriaId_estado_idx" ON "Empresa"("gestoriaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_whatsappMensajeId_key" ON "Documento"("whatsappMensajeId");

-- CreateIndex
CREATE INDEX "Documento_empresaId_imagenHash_idx" ON "Documento"("empresaId", "imagenHash");

-- CreateIndex
CREATE INDEX "Documento_empresaId_trimestre_idx" ON "Documento"("empresaId", "trimestre");

-- CreateIndex
CREATE INDEX "Documento_empresaId_numeroFactura_idx" ON "Documento"("empresaId", "numeroFactura");

-- CreateIndex
CREATE UNIQUE INDEX "LineaImpuesto_documentoId_orden_key" ON "LineaImpuesto"("documentoId", "orden");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_gestoriaId_createdAt_idx" ON "AuditoriaEvento"("gestoriaId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_entidad_entidadId_idx" ON "AuditoriaEvento"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_gestoriaId_fkey" FOREIGN KEY ("gestoriaId") REFERENCES "Gestoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_gestoriaId_fkey" FOREIGN KEY ("gestoriaId") REFERENCES "Gestoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaImpuesto" ADD CONSTRAINT "LineaImpuesto_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaEvento" ADD CONSTRAINT "AuditoriaEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

