// Flujo único de un justificante: deduplicación → límite de IA → extracción →
// validación determinista → persistencia → auditoría. Lo usan la subida web y el webhook de WhatsApp.
import { createHash } from "node:crypto";
import { valorConfig } from "./configuracion";
import { config } from "./env";
import { prisma } from "./prisma";
import { log } from "./logger";
import { consumirLimite } from "./rate-limit";
import { SEMILLA_DOCUMENTOS } from "./seed";
import {
  ExtraccionInvalida,
  FISCAL_SYSTEM_PROMPT,
  mensajeWhatsapp,
  parseExtraccion,
  validarExtraccion,
  type ResultadoFiscal,
} from "./fiscal";
import { MotorVisionNoDisponible, extraerConVision, type ParteEntrada } from "./vision";
import {
  aDocumento,
  buscarDuplicadoPorNumero,
  buscarPorHashImagen,
  crearDocumento,
  registrarAuditoria,
  type NuevoDocumento,
} from "./store";
import type { Documento } from "./types";

export class LimiteIaAlcanzado extends Error {}

export interface EntradaJustificante {
  empresa: { id: string; nombre: string; nif: string; gestoriaId: string | null };
  bytes: Buffer;
  mime: string;
  nombreImagen: string | null;
  origen: "WEB" | "WHATSAPP";
  whatsappMensajeId?: string | null;
}

export interface ResultadoJustificante {
  estado: "creado" | "duplicado";
  documento: Documento;
  /** true solo en modo demostración (DEMO_MODE) con una muestra conocida. */
  simulado: boolean;
}

function ilegibleManual(motivo: string): ResultadoFiscal {
  const base = {
    estado: "ILEGIBLE" as const,
    tipoDocumento: "NO_VALIDO" as const,
    ivaDeducible: false,
    emisorNombre: null,
    emisorNif: null,
    nifEmisorValido: null,
    receptorNombre: null,
    receptorNif: null,
    nifReceptorValido: null,
    numeroFactura: null,
    fechaEmision: null,
    moneda: "EUR",
    lineas: [],
    baseImponible: 0,
    porcentajeIva: 0,
    cuotaIva: 0,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 0,
    cuentaPgc: null,
    confianza: 0,
    motivos: [motivo],
    avisos: [],
  };
  return { ...base, mensajeWhatsapp: mensajeWhatsapp(base) };
}

/** Modo demostración: solo si DEMO_MODE=true y la muestra coincide con la empresa. */
function extraccionDemo(nombre: string | null, empresaId: string): ResultadoFiscal | null {
  if (!nombre) return null;
  const d = SEMILLA_DOCUMENTOS.find((x) => x.imagenNombre === nombre && x.empresaId === empresaId);
  if (!d) return null;
  return {
    estado: d.estado as ResultadoFiscal["estado"],
    tipoDocumento: d.tipoDocumento as ResultadoFiscal["tipoDocumento"],
    ivaDeducible: d.ivaDeducible,
    emisorNombre: d.emisorNombre,
    emisorNif: d.emisorNif,
    nifEmisorValido: d.nifEmisorValido ?? null,
    receptorNombre: d.receptorNombre,
    receptorNif: d.receptorNif,
    nifReceptorValido: d.nifReceptorValido ?? null,
    numeroFactura: d.numeroFactura,
    fechaEmision: d.fechaEmision,
    moneda: d.moneda,
    lineas: [{ orden: 1, baseImponible: d.baseImponible, porcentajeIva: d.porcentajeIva, cuotaIva: d.cuotaIva }],
    baseImponible: d.baseImponible,
    porcentajeIva: d.porcentajeIva,
    cuotaIva: d.cuotaIva,
    irpfPorcentaje: d.irpfPorcentaje,
    irpfImporte: d.irpfImporte,
    totalFactura: d.totalFactura,
    cuentaPgc: d.cuentaPgc,
    confianza: d.confianza,
    motivos: d.motivoRevision ? [d.motivoRevision] : [],
    avisos: [],
    mensajeWhatsapp: d.mensajeWhatsapp ?? "",
  };
}

/** Registra cada llamada a la IA (proveedor, tokens, tiempo, resultado) para el panel de uso y de costes. */
async function registrarUso(e: EntradaJustificante, info: { proveedor: string; modelo: string | null; uso?: { entrada: number; salida: number }; ms: number; ok: boolean }): Promise<void> {
  try {
    await prisma.usoVision.create({
      data: { empresaId: e.empresa.id, proveedor: info.proveedor, modelo: info.modelo, entrada: info.uso?.entrada ?? 0, salida: info.uso?.salida ?? 0, ms: info.ms, ok: info.ok },
    });
  } catch {
    // El registro de uso nunca debe romper la extracción.
  }
}

async function extraerYValidar(e: EntradaJustificante): Promise<ResultadoFiscal> {
  const partes: ParteEntrada[] = [
    {
      tipo: "texto",
      texto: `Analiza este justificante de gasto de la empresa ${e.empresa.nombre} (NIF ${e.empresa.nif}). Devuelve solo el JSON estricto.`,
    },
    { tipo: "archivo", mime: e.mime, base64: e.bytes.toString("base64") },
  ];

  // Un reintento si la respuesta no es JSON válido; los fallos del motor ya se reintentan dentro.
  let ultimo: unknown = null;
  for (let intento = 1; intento <= 2; intento++) {
    const inicio = Date.now();
    let proveedor = "desconocido";
    let modelo: string | null = null;
    let uso: { entrada: number; salida: number } | undefined;
    let raw: string;
    try {
      raw = await extraerConVision(FISCAL_SYSTEM_PROMPT, partes, {
        onProveedor: (p, m) => {
          proveedor = p;
          modelo = m;
        },
        onUso: (u) => (uso = u),
      });
    } catch (fallo) {
      await registrarUso(e, { proveedor, modelo, ms: Date.now() - inicio, ok: false });
      throw fallo;
    }
    await registrarUso(e, { proveedor, modelo, uso, ms: Date.now() - inicio, ok: true });
    try {
      return validarExtraccion(parseExtraccion(raw), { nifEmpresa: e.empresa.nif });
    } catch (err) {
      if (!(err instanceof ExtraccionInvalida)) throw err;
      ultimo = err;
      log("warn", "pipeline.extraccion_invalida", { intento });
    }
  }
  throw ultimo instanceof Error ? ultimo : new ExtraccionInvalida("Extracción no válida");
}

function esConflictoUnico(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function procesarJustificante(e: EntradaJustificante): Promise<ResultadoJustificante> {
  const imagenHash = createHash("sha256").update(e.bytes).digest("hex");

  // 1) Duplicado exacto: no consume IA.
  const previo = await buscarPorHashImagen(e.empresa.id, imagenHash);
  if (previo) return { estado: "duplicado", documento: aDocumento(previo), simulado: false };

  // 2) Límite diario de extracciones por empresa (control de coste).
  const dia = new Date().toISOString().slice(0, 10);
  const maximo = await valorConfig<number>("limiteIaDiarioEmpresa", config().LIMITE_IA_DIARIO_EMPRESA);
  const limite = await consumirLimite(`ia:${e.empresa.id}:${dia}`, maximo, 86_400);
  if (!limite.permitido) throw new LimiteIaAlcanzado("Límite diario de justificantes alcanzado");

  // 3) Extracción. Sin motor: error, salvo modo demostración.
  let resultado: ResultadoFiscal;
  let simulado = false;
  try {
    resultado = await extraerYValidar(e);
  } catch (err) {
    if (err instanceof MotorVisionNoDisponible) {
      const demo = config().DEMO_MODE ? extraccionDemo(e.nombreImagen, e.empresa.id) : null;
      if (!demo) throw err;
      resultado = demo;
      simulado = true;
    } else if (err instanceof ExtraccionInvalida) {
      resultado = ilegibleManual("No se pudo interpretar automáticamente el justificante; revisión manual.");
    } else {
      throw err;
    }
  }

  // 4) Posible duplicado por número de factura del mismo emisor (p. ej. foto distinta del mismo papel).
  if (resultado.estado !== "ILEGIBLE" && resultado.emisorNif && resultado.numeroFactura) {
    const dup = await buscarDuplicadoPorNumero(e.empresa.id, resultado.emisorNif, resultado.numeroFactura);
    if (dup) {
      resultado.motivos.push(`Posible duplicado: ya existe la factura nº ${dup.numeroFactura} de este emisor.`);
      resultado.estado = "REQUIERE_REVISION";
      resultado.mensajeWhatsapp = mensajeWhatsapp(resultado);
    }
  }

  // 5) Persistencia.
  const nuevo: NuevoDocumento = {
    empresaId: e.empresa.id,
    estado: resultado.estado,
    tipoDocumento: resultado.tipoDocumento,
    ivaDeducible: resultado.ivaDeducible,
    emisorNombre: resultado.emisorNombre,
    emisorNif: resultado.emisorNif,
    nifEmisorValido: resultado.nifEmisorValido,
    receptorNombre: resultado.receptorNombre,
    receptorNif: resultado.receptorNif,
    nifReceptorValido: resultado.nifReceptorValido,
    numeroFactura: resultado.numeroFactura,
    fechaEmision: resultado.fechaEmision,
    moneda: resultado.moneda,
    lineas: resultado.lineas,
    baseImponible: resultado.baseImponible,
    porcentajeIva: resultado.porcentajeIva,
    cuotaIva: resultado.cuotaIva,
    irpfPorcentaje: resultado.irpfPorcentaje,
    irpfImporte: resultado.irpfImporte,
    totalFactura: resultado.totalFactura,
    cuentaPgc: resultado.cuentaPgc,
    confianza: resultado.confianza,
    motivoRevision: resultado.motivos.length ? resultado.motivos.join(" ") : null,
    mensajeWhatsapp: resultado.mensajeWhatsapp,
    imagenNombre: e.nombreImagen ? e.nombreImagen.slice(0, 200) : null,
    imagenMime: e.mime,
    imagenBytes: e.bytes.length,
    imagenHash,
    origen: e.origen,
    whatsappMensajeId: e.whatsappMensajeId ?? null,
  };

  let fila;
  try {
    fila = await crearDocumento(nuevo);
  } catch (err) {
    // Reentrega del mismo mensaje de WhatsApp: idempotencia por wamid.
    if (esConflictoUnico(err) && e.whatsappMensajeId) {
      const existente = await buscarPorHashImagen(e.empresa.id, imagenHash);
      if (existente) return { estado: "duplicado", documento: aDocumento(existente), simulado: false };
    }
    throw err;
  }

  await registrarAuditoria({
    gestoriaId: e.empresa.gestoriaId,
    accion: "documento.creado",
    entidad: "Documento",
    entidadId: fila.id,
    detalle: { origen: e.origen, estado: resultado.estado, tipo: resultado.tipoDocumento, simulado },
  });
  log("info", "documento.creado", { origen: e.origen, estado: resultado.estado, simulado });

  return { estado: "creado", documento: aDocumento(fila), simulado };
}

