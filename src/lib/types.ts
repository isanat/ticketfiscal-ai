// Tipos compartidos frontend ↔ backend
export interface Documento {
  id: string;
  clienteNombre: string;
  clienteNif: string;
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

export const CLIENTE_DEMO = {
  nombre: "Juan Pérez García",
  nif: "12345678Z",
  negocio: "Taller mecánico · Autónomo",
};
