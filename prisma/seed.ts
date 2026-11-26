// Cartera de demostración. Idempotente (upsert). Solo con SEED_DEMO=true.
// En producción exige además ALLOW_DEMO_IN_PRODUCTION=true, para no crear cuentas de
// demostración con contraseña conocida por error.
//
// Uso: bun run db:seed   (requiere DATABASE_URL o DIRECT_URL)
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash";
import { trimestreDe } from "../src/lib/fiscal";
import {
  SEMILLA_DOCUMENTOS,
  SEMILLA_EMPRESAS,
  SEMILLA_GESTORIAS,
  SEMILLA_USUARIOS,
  createdAtDe,
} from "../src/lib/seed";

const prisma = new PrismaClient();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function main(): Promise<void> {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO no está activado: no se siembra nada.");
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_IN_PRODUCTION !== "true") {
    throw new Error("Sembrar la demo en producción requiere ALLOW_DEMO_IN_PRODUCTION=true");
  }

  for (const g of SEMILLA_GESTORIAS) {
    await prisma.gestoria.upsert({
      where: { id: g.id },
      update: {},
      create: { id: g.id, nombre: g.nombre, cif: g.cif, ciudad: g.ciudad },
    });
  }

  for (const e of SEMILLA_EMPRESAS) {
    const datos = {
      nombre: e.nombre,
      nif: e.nif,
      direccion: e.direccion,
      ciudad: e.ciudad,
      whatsapp: e.whatsapp ? e.whatsapp.replace(/\D/g, "") : null,
      gestoriaId: e.gestoriaId,
      estado: "APROBADA" as const,
    };
    await prisma.empresa.upsert({
      where: { id: e.id },
      update: {},
      create: { id: e.id, ...datos, createdAt: new Date("2026-01-05T09:00:00Z") },
    });
  }

  for (const u of SEMILLA_USUARIOS) {
    await prisma.usuario.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        nombre: u.nombre,
        rol: u.rol,
        gestoriaId: u.gestoriaId,
        empresaId: u.empresaId,
      },
    });
  }

  for (const d of SEMILLA_DOCUMENTOS) {
    const fecha = d.fechaEmision ? new Date(`${d.fechaEmision}T00:00:00Z`) : null;
    await prisma.documento.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        empresaId: d.empresaId,
        estado: d.estado as "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE",
        tipoDocumento: d.tipoDocumento as "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA" | "NO_VALIDO",
        ivaDeducible: d.ivaDeducible,
        emisorNombre: d.emisorNombre,
        emisorNif: d.emisorNif,
        nifEmisorValido: d.nifEmisorValido ?? null,
        receptorNombre: d.receptorNombre,
        receptorNif: d.receptorNif,
        nifReceptorValido: d.nifReceptorValido ?? null,
        numeroFactura: d.numeroFactura,
        fechaEmision: fecha,
        moneda: d.moneda,
        baseImponible: d.baseImponible,
        porcentajeIva: d.porcentajeIva,
        cuotaIva: d.cuotaIva,
        irpfPorcentaje: d.irpfPorcentaje,
        irpfImporte: d.irpfImporte,
        totalFactura: d.totalFactura,
        cuentaPgc: d.cuentaPgc,
        confianza: d.confianza,
        motivoRevision: d.motivoRevision,
        mensajeWhatsapp: d.mensajeWhatsapp,
        imagenNombre: d.imagenNombre,
        imagenMime: "image/png",
        imagenBytes: 0,
        imagenHash: sha256(`seed:${d.id}`),
        origen: "WEB",
        trimestre: d.trimestre ?? trimestreDe(d.fechaEmision),
        revision: d.estado === "VALIDO" ? "APROBADO" : "PENDIENTE",
        createdAt: new Date(createdAtDe(d)),
        lineas: {
          create: [{ orden: 1, baseImponible: d.baseImponible, porcentajeIva: d.porcentajeIva, cuotaIva: d.cuotaIva }],
        },
      },
    });
  }

  console.log(
    `Demo sembrada: ${SEMILLA_GESTORIAS.length} gestoría, ${SEMILLA_EMPRESAS.length} empresas, ${SEMILLA_DOCUMENTOS.length} documentos.`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
