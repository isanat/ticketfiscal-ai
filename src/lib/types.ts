// Tipos compartidos frontend ↔ backend (multi-tenant)

export type Rol = "GESTOR" | "CLIENTE" | "ADMIN";
export type EstadoGestoria = "PENDIENTE" | "ACTIVA" | "SUSPENDIDA";

/** Lo que ve el cliente de su propia sesión (nunca el hash). */
export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  gestoria?: { id: string; nombre: string; estado: EstadoGestoria };
  empresa?: { id: string; nombre: string; nif: string; ciudad?: string | null; estado: EstadoEmpresa };
  /** La cuenta está suspendida: no se admite la sesión. Solo uso interno del servidor. */
  suspendida?: boolean;
  /** Sesión de soporte abierta por un administrador (se muestra un aviso en la interfaz). */
  soporte?: boolean;
}

export type EstadoEmpresa = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "SUSPENDIDA";

export interface Empresa {
  id: string;
  nombre: string;
  nif: string;
  direccion: string | null;
  ciudad: string | null;
  whatsapp: string | null;
  gestoriaId: string | null;
  estado: EstadoEmpresa;
  createdAt: string;
}

export interface EmpresaResumen extends Empresa {
  documentos: number;
  pendientes: number;
  ivaDeducible: number;
  ultimoDocumento: string | null;
}

export type RevisionDocumento = "PENDIENTE" | "APROBADO" | "RECHAZADO";

/** Desglose de IVA por tipo. Un documento puede tener varios (10 % y 21 %). */
export interface LineaImpuesto {
  orden: number;
  baseImponible: number;
  porcentajeIva: number;
  cuotaIva: number;
}

export interface Documento {
  id: string;
  empresaId: string;
  estado: "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE" | string;
  tipoDocumento: "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA" | "NO_VALIDO" | string;
  ivaDeducible: boolean;
  emisorNombre: string | null;
  emisorNif: string | null;
  nifEmisorValido?: boolean | null;
  receptorNombre: string | null;
  receptorNif: string | null;
  nifReceptorValido?: boolean | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  moneda: string;
  baseImponible: number;
  porcentajeIva: number;
  cuotaIva: number;
  irpfPorcentaje: number;
  irpfImporte: number;
  totalFactura: number;
  cuentaPgc: string | null;
  confianza: number;
  motivoRevision: string | null;
  mensajeWhatsapp: string | null;
  imagenNombre: string | null;
  trimestre: string | null;
  desglose: LineaImpuesto[];
  revision: RevisionDocumento;
  revisadoEn: string | null;
  origen: "WEB" | "WHATSAPP";
  createdAt: string;
}

export interface Muestra {
  archivo: string;
  titulo: string;
  descripcion: string;
}

export const MUESTRAS: Muestra[] = [
  {
    archivo: "/samples/factura-completa.png",
    titulo: "Factura proveedor (A4)",
    descripcion: "Distribuciones Ferrallado S.L.",
  },
  {
    archivo: "/samples/ticket-restaurante.png",
    titulo: "Ticket restaurante",
    descripcion: "Menú del día · IVA 10% incluido",
  },
  {
    archivo: "/samples/factura-error.png",
    titulo: "Factura luz (con errores)",
    descripcion: "Eléctricas del Sur S.A. · descuadre IVA + CIF erróneo",
  },
  {
    archivo: "/samples/ticket-gasolinera.png",
    titulo: "Ticket gasolinera",
    descripcion: "Gasóleo A · IVA 21% incluido",
  },
];

export interface RespuestaNifLookup {
  nif: string;
  formatoValido: boolean;
  motivo: string | null;
  vies: {
    consultable: boolean;
    valido: boolean | null;
    nombre: string | null;
    direccion: string | null;
  };
}
