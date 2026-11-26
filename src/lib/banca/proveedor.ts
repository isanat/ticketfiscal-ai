// Contrato común de los proveedores de Open Banking. Hoy solo hay uno (GoCardless Bank Account Data);
// la importación manual (CSV / Norma 43) sigue siendo el camino que funciona sin credenciales.
import type { MovimientoLeido } from "../extracto";

export interface Institucion {
  id: string;
  nombre: string;
  /** Días de histórico que el banco permite consultar. */
  diasHistorico: number | null;
}

export type EstadoConexion = "PENDIENTE" | "ACTIVA" | "CADUCADA" | "ERROR";

export interface ProveedorBancario {
  readonly nombre: string;
  /** Hay credenciales configuradas. No implica que el proveedor admita altas nuevas. */
  disponible(): boolean;
  listarInstituciones(pais: string): Promise<Institucion[]>;
  /** Crea el enlace de consentimiento al que se redirige al titular de la cuenta (PSD2). */
  iniciarConexion(p: { institucionId: string; redirectUrl: string; referencia: string }): Promise<{ referenciaExterna: string; enlace: string }>;
  estadoConexion(referenciaExterna: string): Promise<{ estado: EstadoConexion; cuentas: string[] }>;
  movimientos(cuentaId: string, desde: string, hasta: string): Promise<MovimientoLeido[]>;
}

export class ProveedorBancarioNoDisponible extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ProveedorBancarioNoDisponible";
  }
}
