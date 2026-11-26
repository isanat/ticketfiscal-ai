// TicketFiscal AI — Cartera de demostración multi-tenant.
// 1 gestoría · 3 empresas · 13 justificantes de dos trimestres, con todos los
// casos que un asesor fiscal quiere ver: válidos, descuadres, CIF erróneo,
// IVA no deducible (art. 97 LIVA), retención de IRPF (art. 100 LIRPF) e ilegible.
//
// Todos los NIF/CIF pasan la validación determinística del dígito de control,
// salvo A28547963 (Eléctricas del Sur) que es el caso de prueba intencionado.

import type { Documento, Empresa, Rol } from "./types";

export interface GestoriaSeed {
  id: string;
  nombre: string;
  cif: string | null;
  ciudad: string | null;
}

export interface UsuarioSeed {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  password: string; // en claro solo aquí; el store la hashea al sembrar
  gestoriaId: string | null;
  empresaId: string | null;
}

export type EmpresaSeed = Omit<Empresa, "createdAt">;

export type DocumentoSeed = Omit<Documento, "createdAt">;

export const SEMILLA_GESTORIAS: GestoriaSeed[] = [
  {
    id: "gestoria-alboraya",
    nombre: "Gestoría Alboraya, S.L.P.",
    cif: "B460123450",
    ciudad: "Valencia",
  },
];

export const SEMILLA_USUARIOS: UsuarioSeed[] = [
  {
    id: "usuario-ana",
    email: "ana@gestoriaalboraya.es",
    nombre: "Ana Ruiz Beltrán",
    rol: "GESTOR",
    password: "demo1234",
    gestoriaId: "gestoria-alboraya",
    empresaId: null,
  },
  {
    id: "usuario-juan",
    email: "juan@tallerperez.es",
    nombre: "Juan Pérez García",
    rol: "CLIENTE",
    password: "demo1234",
    gestoriaId: null,
    empresaId: "empresa-taller",
  },
  {
    id: "usuario-marta",
    email: "marta@panaderiadulce.es",
    nombre: "Marta Ferrer Bou",
    rol: "CLIENTE",
    password: "demo1234",
    gestoriaId: null,
    empresaId: "empresa-panaderia",
  },
  {
    id: "usuario-maria",
    email: "maria@clinicadentalsonrisa.es",
    nombre: "María López Soto",
    rol: "CLIENTE",
    password: "demo1234",
    gestoriaId: null,
    empresaId: "empresa-clinica",
  },
];

export const SEMILLA_EMPRESAS: EmpresaSeed[] = [
  {
    id: "empresa-taller",
    nombre: "Taller Pérez e Hijos",
    nif: "12345678Z",
    direccion: "C/ Mayor 14, nave 3",
    ciudad: "Valencia",
    whatsapp: "+34 640 111 222",
    gestoriaId: "gestoria-alboraya",
  },
  {
    id: "empresa-panaderia",
    nombre: "Panadería Dulce Levante, S.L.",
    nif: "B460678908",
    direccion: "Av. del Puerto 88",
    ciudad: "Valencia",
    whatsapp: "+34 640 333 444",
    gestoriaId: "gestoria-alboraya",
  },
  {
    id: "empresa-clinica",
    nombre: "Clínica Dental Sonrisa Mediterránea, S.L.",
    nif: "A285555555",
    direccion: "C/ Serrano 210",
    ciudad: "Madrid",
    whatsapp: "+34 610 555 666",
    gestoriaId: "gestoria-alboraya",
  },
];

// ---------------------------------------------------------------------------
// Justificantes — Taller Pérez (los 4 de las muestras + 2 por WhatsApp)
// ---------------------------------------------------------------------------

const taller: DocumentoSeed[] = [
  {
    id: "doc-taller-ferrallado",
    empresaId: "empresa-taller",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Distribuciones Ferrallado, S.L.",
    emisorNif: "B46283917",
    nifEmisorValido: true,
    receptorNombre: "Taller Pérez e Hijos",
    receptorNif: "12345678Z",
    nifReceptorValido: true,
    numeroFactura: "2026/0457",
    fechaEmision: "2026-07-14",
    moneda: "EUR",
    baseImponible: 100,
    porcentajeIva: 21,
    cuotaIva: 21,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 121,
    cuentaPgc: "600",
    confianza: 0.97,
    motivoRevision: null,
    mensajeWhatsapp:
      "¡Recibida, Juan! Factura 2026/0457 de Ferrallado registrada (121,00 €, IVA 21 % deducible). Ya está en el lote de asientos del trimestre.",
    imagenNombre: "Factura proveedor (A4)",
    trimestre: "3T2026",
  },
  {
    id: "doc-taller-restaurante",
    empresaId: "empresa-taller",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_SIMPLIFICADA",
    ivaDeducible: false,
    emisorNombre: "Bar-Restaurante El Cruce",
    emisorNif: "B46912382",
    nifEmisorValido: true,
    receptorNombre: null,
    receptorNif: null,
    nifReceptorValido: null,
    numeroFactura: "00342",
    fechaEmision: "2026-07-15",
    moneda: "EUR",
    baseImponible: 21.82,
    porcentajeIva: 10,
    cuotaIva: 2.18,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 24,
    cuentaPgc: "629",
    confianza: 0.95,
    motivoRevision:
      "Factura simplificada sin datos fiscales del destinatario: IVA no deducible (art. 97 LIVA). Se recomienda solicitar factura completa.",
    mensajeWhatsapp:
      "¡Recibido! Es un ticket simplificado, así que el IVA (2,18 €) no es deducible sin tus datos fiscales. Si quieres deducirlo, pide la factura completa con tu NIF y reenvíamela.",
    imagenNombre: "Ticket restaurante",
    trimestre: "3T2026",
  },
  {
    id: "doc-taller-luz",
    empresaId: "empresa-taller",
    estado: "REQUIERE_REVISION",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Eléctricas del Sur, S.A.",
    emisorNif: "A28547963",
    nifEmisorValido: false,
    receptorNombre: "Taller Pérez e Hijos",
    receptorNif: "12345678Z",
    nifReceptorValido: true,
    numeroFactura: "2026-038912",
    fechaEmision: "2026-07-31",
    moneda: "EUR",
    baseImponible: 85.95,
    porcentajeIva: 21,
    cuotaIva: 19.05,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 105,
    cuentaPgc: "628",
    confianza: 0.93,
    motivoRevision:
      "NIF no válido: el dígito de control de A28547963 debería ser «6» y figura «3». Además, la cuota soportada (19,05 €) no coincide con el 21 % de la base (18,05 € esperados). Compruebe la imagen original antes de contabilizar.",
    mensajeWhatsapp:
      "La he recibido, pero tiene dos fallos: el IVA del resumen no cuadra con la base y el CIF del emisor parece tener el dígito de control erróneo. ¿Puedes pedirle a la eléctrica la factura corregida? Mientras tanto queda en la bandeja de revisión.",
    imagenNombre: "Factura luz (con errores)",
    trimestre: "3T2026",
  },
  {
    id: "doc-taller-gasolinera",
    empresaId: "empresa-taller",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_SIMPLIFICADA",
    ivaDeducible: false,
    emisorNombre: "Estación de Servicio La Vía, S.L.",
    emisorNif: "B46539128",
    nifEmisorValido: true,
    receptorNombre: null,
    receptorNif: null,
    nifReceptorValido: null,
    numeroFactura: "07891",
    fechaEmision: "2026-07-18",
    moneda: "EUR",
    baseImponible: 46.36,
    porcentajeIva: 21,
    cuotaIva: 9.74,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 56.1,
    cuentaPgc: "629",
    confianza: 0.96,
    motivoRevision:
      "Factura simplificada sin datos fiscales del destinatario: IVA no deducible (art. 97 LIVA). En gasolineras se puede pedir factura completa con matrícula y NIF.",
    mensajeWhatsapp:
      "¡Recibido! Gasóleo por 56,10 €. Ojo: al ser ticket simplificado sin tus datos, el IVA (9,74 €) no es deducible. En la gasolinera pueden reemitirte la factura completa con tu NIF y matrícula; mándamela y la sustituyo.",
    imagenNombre: "Ticket gasolinera",
    trimestre: "3T2026",
  },
  {
    id: "doc-taller-alquiler",
    empresaId: "empresa-taller",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Inmuebles Levante, S.L.",
    emisorNif: "B36004596",
    nifEmisorValido: true,
    receptorNombre: "Taller Pérez e Hijos",
    receptorNif: "12345678Z",
    nifReceptorValido: true,
    numeroFactura: "AR-2026-0112",
    fechaEmision: "2026-07-01",
    moneda: "EUR",
    baseImponible: 400,
    porcentajeIva: 21,
    cuotaIva: 84,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 484,
    cuentaPgc: "621",
    confianza: 0.98,
    motivoRevision: null,
    mensajeWhatsapp:
      "Registrado el alquiler del taller de julio (484,00 € con IVA). Cuenta 621 del PGC, listo para el asiento.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-taller-mensajeria",
    empresaId: "empresa-taller",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Transportes Rápidos Valencia, S.L.",
    emisorNif: "B98712342",
    nifEmisorValido: true,
    receptorNombre: "Taller Pérez e Hijos",
    receptorNif: "12345678Z",
    nifReceptorValido: true,
    numeroFactura: "TRV-3391",
    fechaEmision: "2026-06-20",
    moneda: "EUR",
    baseImponible: 28.1,
    porcentajeIva: 21,
    cuotaIva: 5.9,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 34,
    cuentaPgc: "624",
    confianza: 0.97,
    motivoRevision: null,
    mensajeWhatsapp:
      "Recibida la factura de mensajería TRV-3391 (34,00 €). Clasificada en transportes, cuenta 624.",
    imagenNombre: "subida propia",
    trimestre: "2T2026",
  },
];

// ---------------------------------------------------------------------------
// Justificantes — Panadería Dulce Levante (IVA 4 % y 10 %)
// ---------------------------------------------------------------------------

const panaderia: DocumentoSeed[] = [
  {
    id: "doc-pan-lacteos",
    empresaId: "empresa-panaderia",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Frigoríficos Lácteos, S.L.",
    emisorNif: "B461122331",
    nifEmisorValido: true,
    receptorNombre: "Panadería Dulce Levante, S.L.",
    receptorNif: "B460678908",
    nifReceptorValido: true,
    numeroFactura: "FL-2026-1187",
    fechaEmision: "2026-07-05",
    moneda: "EUR",
    baseImponible: 500,
    porcentajeIva: 4,
    cuotaIva: 20,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 520,
    cuentaPgc: "600",
    confianza: 0.98,
    motivoRevision: null,
    mensajeWhatsapp:
      "¡Recibida, Marta! Factura FL-2026-1187 de Lácteos (520,00 €, IVA 4 % superreducido). Registrada en compras.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-pan-harinera",
    empresaId: "empresa-panaderia",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Harinera Valenciana, S.L.",
    emisorNif: "B460009998",
    nifEmisorValido: true,
    receptorNombre: "Panadería Dulce Levante, S.L.",
    receptorNif: "B460678908",
    nifReceptorValido: true,
    numeroFactura: "HV/26-0994",
    fechaEmision: "2026-07-12",
    moneda: "EUR",
    baseImponible: 300,
    porcentajeIva: 10,
    cuotaIva: 30,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 330,
    cuentaPgc: "600",
    confianza: 0.97,
    motivoRevision: null,
    mensajeWhatsapp:
      "Factura de la harinera registrada (330,00 €, IVA 10 %). Cuenta 600, compras de mercaderías.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-pan-gasoleo",
    empresaId: "empresa-panaderia",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_SIMPLIFICADA",
    ivaDeducible: false,
    emisorNombre: "Estación de Servicio La Vía, S.L.",
    emisorNif: "B46539128",
    nifEmisorValido: true,
    receptorNombre: null,
    receptorNif: null,
    nifReceptorValido: null,
    numeroFactura: "08127",
    fechaEmision: "2026-08-02",
    moneda: "EUR",
    baseImponible: 56.61,
    porcentajeIva: 21,
    cuotaIva: 11.89,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 68.5,
    cuentaPgc: "629",
    confianza: 0.95,
    motivoRevision:
      "Factura simplificada sin datos fiscales del destinatario: IVA no deducible (art. 97 LIVA). Para el reparto a domicilio conviene pedir factura completa con matrícula de la furgoneta.",
    mensajeWhatsapp:
      "¡Recibido el del gasóleo (68,50 €)! Como es ticket simplificado, el IVA no es deducible; pide la factura completa con la matrícula de la furgoneta y te la sustituyo.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-pan-menu",
    empresaId: "empresa-panaderia",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_SIMPLIFICADA",
    ivaDeducible: false,
    emisorNombre: "Bar Casa Pilar",
    emisorNif: "B46955514",
    nifEmisorValido: true,
    receptorNombre: null,
    receptorNif: null,
    nifReceptorValido: null,
    numeroFactura: "01188",
    fechaEmision: "2026-08-14",
    moneda: "EUR",
    baseImponible: 28.36,
    porcentajeIva: 10,
    cuotaIva: 2.84,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 31.2,
    cuentaPgc: "629",
    confianza: 0.94,
    motivoRevision:
      "Factura simplificada sin datos fiscales del destinatario: IVA no deducible (art. 97 LIVA).",
    mensajeWhatsapp:
      "¡Recibido! Menú por 31,20 €. Al ser ticket simplificado el IVA no es deducible; si quieres, pide factura completa con el NIF de la sociedad.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
];

// ---------------------------------------------------------------------------
// Justificantes — Clínica Dental Sonrisa (IRPF, 600, ilegible)
// ---------------------------------------------------------------------------

const clinica: DocumentoSeed[] = [
  {
    id: "doc-clinica-bufete",
    empresaId: "empresa-clinica",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "Bufete Alonso & Asociados",
    emisorNif: "24567890A",
    nifEmisorValido: true,
    receptorNombre: "Clínica Dental Sonrisa Mediterránea, S.L.",
    receptorNif: "A285555555",
    nifReceptorValido: true,
    numeroFactura: "BA 2026/0712",
    fechaEmision: "2026-07-09",
    moneda: "EUR",
    baseImponible: 200,
    porcentajeIva: 21,
    cuotaIva: 42,
    irpfPorcentaje: 15,
    irpfImporte: 30,
    totalFactura: 212,
    cuentaPgc: "623",
    confianza: 0.98,
    motivoRevision: null,
    mensajeWhatsapp:
      "Recibida la minuta del bufete (212,00 € con retención de IRPF del 15 %). Cuenta 623, servicios de profesionales independientes.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-clinica-dentalmax",
    empresaId: "empresa-clinica",
    estado: "VALIDO",
    tipoDocumento: "FACTURA_COMPLETA",
    ivaDeducible: true,
    emisorNombre: "DentalMax Iberia, S.L.",
    emisorNif: "B871234561",
    nifEmisorValido: true,
    receptorNombre: "Clínica Dental Sonrisa Mediterránea, S.L.",
    receptorNif: "A285555555",
    nifReceptorValido: true,
    numeroFactura: "DMX-26-08450",
    fechaEmision: "2026-08-21",
    moneda: "EUR",
    baseImponible: 850,
    porcentajeIva: 21,
    cuotaIva: 178.5,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 1028.5,
    cuentaPgc: "600",
    confianza: 0.99,
    motivoRevision: null,
    mensajeWhatsapp:
      "Factura de material dental DMX-26-08450 registrada (1.028,50 €, IVA 21 % deducible).",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
  {
    id: "doc-clinica-ilegible",
    empresaId: "empresa-clinica",
    estado: "ILEGIBLE",
    tipoDocumento: "NO_VALIDO",
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
    baseImponible: 0,
    porcentajeIva: 0,
    cuotaIva: 0,
    irpfPorcentaje: 0,
    irpfImporte: 0,
    totalFactura: 0,
    cuentaPgc: null,
    confianza: 0.2,
    motivoRevision:
      "La imagen no permite leer el importe ni el NIF del emisor (foto movida y parcialmente cortada). Se ha pedido al cliente una nueva fotografía con el documento completo en el encuadre.",
    mensajeWhatsapp:
      "María, la foto del justificante ha salido movida y no consigo leer el importe. ¿Puedes repetirla con el documento completo y bien iluminado? En cuanto la reciba la registro.",
    imagenNombre: "subida propia",
    trimestre: "3T2026",
  },
];

export const SEMILLA_DOCUMENTOS: DocumentoSeed[] = [...taller, ...panaderia, ...clinica];

/** Fechas de creación coherentes con la fecha de emisión (para ordenar el lote). */
export function createdAtDe(doc: DocumentoSeed): string {
  const base = doc.fechaEmision ?? "2026-07-01";
  return `${base}T18:02:00.000Z`;
}
