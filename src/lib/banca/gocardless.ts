// Adaptador de GoCardless Bank Account Data (antes Nordigen).
//
// ESTADO: PREPARADO, SIN VERIFICAR CONTRA EL SERVICIO REAL.
//  - Se escribió a partir de la documentación pública de la API v2; desde el entorno de desarrollo
//    no se puede alcanzar el host, así que no se ha probado con credenciales ni con un banco.
//  - Fuentes secundarias indican que GoCardless ha CERRADO las altas nuevas de esta API (nov. 2026): puede que
//    no se puedan obtener credenciales. Verifíquelo en su panel; si es así, sustituya el proveedor. La importación CSV/Norma 43 no depende de esto.
//  - Los formatos de respuesta están cubiertos por pruebas con cargas de ejemplo; hay que contrastarlos
//    con respuestas reales (sandbox "SANDBOXFINANCE_SFIN0000") antes de activarlo en producción.
import { asignarIdsEstables, type MovimientoLeido } from "../extracto";
import { config } from "../env";
import type { EstadoConexion, Institucion, ProveedorBancario } from "./proveedor";
import { ProveedorBancarioNoDisponible } from "./proveedor";

const BASE = "https://bankaccountdata.gocardless.com/api/v2";
const TIMEOUT_MS = 15_000;

interface Token {
  acceso: string;
  expiraEn: number;
}

// ------------------------------------------------------------------ Mapeo (puro y probado)

interface TransaccionApi {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  bookingDateTime?: string;
  transactionAmount?: { amount?: string; currency?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  additionalInformation?: string;
}

export interface RespuestaTransacciones {
  transactions?: { booked?: TransaccionApi[]; pending?: TransaccionApi[] };
}

function centimos(texto: string | undefined): number | null {
  if (!texto || !/^-?\d+(\.\d{1,4})?$/.test(texto.trim())) return null;
  return Math.round(Number(texto) * 100);
}

/**
 * Convierte la respuesta del proveedor en movimientos normalizados.
 * Solo los apuntes «booked» (contabilizados): los «pending» pueden cambiar de importe o desaparecer.
 * Solo EUR: otras divisas no se pueden cruzar con justificantes en euros y se cuentan como ignoradas.
 */
export function aMovimientos(r: RespuestaTransacciones): { movimientos: MovimientoLeido[]; ignoradas: number } {
  const booked = r.transactions?.booked ?? [];
  const conId: MovimientoLeido[] = [];
  const sinId: Array<Omit<MovimientoLeido, "idExterno">> = [];
  let ignoradas = 0;

  for (const t of booked) {
    const cent = centimos(t.transactionAmount?.amount);
    const fecha = (t.bookingDate ?? t.valueDate ?? t.bookingDateTime ?? "").slice(0, 10);
    if (cent === null || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || (t.transactionAmount?.currency ?? "EUR") !== "EUR") {
      ignoradas++;
      continue;
    }
    const descripcion = (
      t.remittanceInformationUnstructured ||
      t.remittanceInformationUnstructuredArray?.join(" ") ||
      (cent < 0 ? t.creditorName : t.debtorName) ||
      t.additionalInformation ||
      "Movimiento sin concepto"
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    const id = t.transactionId || t.internalTransactionId;
    if (id) conId.push({ idExterno: `gc:${id}`.slice(0, 80), fecha, importeCent: cent, descripcion });
    else sinId.push({ fecha, importeCent: cent, descripcion });
  }
  return { movimientos: [...conId, ...asignarIdsEstables(sinId)], ignoradas };
}

function estadoDe(codigo: string | undefined): EstadoConexion {
  switch (codigo) {
    case "LN":
      return "ACTIVA";
    case "EX":
    case "RJ":
    case "SA":
      return "CADUCADA";
    case "ER":
    case "UA":
      return "ERROR";
    default:
      return "PENDIENTE"; // CR, ID, GC, SU…: consentimiento en curso
  }
}

// ------------------------------------------------------------------ Cliente

export class GoCardless implements ProveedorBancario {
  readonly nombre = "gocardless";
  private token: Token | null = null;

  constructor(
    private readonly credenciales: { secretId?: string; secretKey?: string } = {
      secretId: config().GOCARDLESS_SECRET_ID,
      secretKey: config().GOCARDLESS_SECRET_KEY,
    },
    private readonly http: typeof fetch = fetch
  ) {}

  disponible(): boolean {
    return Boolean(this.credenciales.secretId && this.credenciales.secretKey);
  }

  private async acceso(): Promise<string> {
    if (this.token && this.token.expiraEn > Date.now() + 60_000) return this.token.acceso;
    if (!this.disponible()) throw new ProveedorBancarioNoDisponible("GoCardless no está configurado");
    const r = await this.http(`${BASE}/token/new/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ secret_id: this.credenciales.secretId, secret_key: this.credenciales.secretKey }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) throw new ProveedorBancarioNoDisponible(`GoCardless rechazó las credenciales (HTTP ${r.status})`);
    const js = (await r.json()) as { access?: string; access_expires?: number };
    if (!js.access) throw new ProveedorBancarioNoDisponible("GoCardless no devolvió token de acceso");
    this.token = { acceso: js.access, expiraEn: Date.now() + (js.access_expires ?? 3600) * 1000 };
    return js.access;
  }

  private async llamar<T>(ruta: string, init?: { metodo?: string; cuerpo?: unknown }): Promise<T> {
    const acceso = await this.acceso();
    const r = await this.http(`${BASE}${ruta}`, {
      method: init?.metodo ?? "GET",
      headers: { Authorization: `Bearer ${acceso}`, Accept: "application/json", "Content-Type": "application/json" },
      body: init?.cuerpo !== undefined ? JSON.stringify(init.cuerpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.status === 429) throw new ProveedorBancarioNoDisponible("GoCardless: límite de consultas del banco alcanzado; reintente más tarde");
    if (!r.ok) throw new ProveedorBancarioNoDisponible(`GoCardless respondió HTTP ${r.status}`);
    return (await r.json()) as T;
  }

  async listarInstituciones(pais: string): Promise<Institucion[]> {
    if (!/^[A-Za-z]{2}$/.test(pais)) throw new Error("País no válido");
    const js = await this.llamar<Array<{ id: string; name: string; transaction_total_days?: string }>>(`/institutions/?country=${pais.toLowerCase()}`);
    return js.map((i) => ({ id: i.id, nombre: i.name, diasHistorico: i.transaction_total_days ? Number(i.transaction_total_days) : null }));
  }

  async iniciarConexion(p: { institucionId: string; redirectUrl: string; referencia: string }) {
    const js = await this.llamar<{ id: string; link: string }>("/requisitions/", {
      metodo: "POST",
      cuerpo: { redirect: p.redirectUrl, institution_id: p.institucionId, reference: p.referencia, user_language: "ES" },
    });
    return { referenciaExterna: js.id, enlace: js.link };
  }

  async estadoConexion(referenciaExterna: string) {
    const js = await this.llamar<{ status?: string; accounts?: string[] }>(`/requisitions/${encodeURIComponent(referenciaExterna)}/`);
    return { estado: estadoDe(js.status), cuentas: js.accounts ?? [] };
  }

  async movimientos(cuentaId: string, desde: string, hasta: string): Promise<MovimientoLeido[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new Error("Fechas no válidas");
    const js = await this.llamar<RespuestaTransacciones>(
      `/accounts/${encodeURIComponent(cuentaId)}/transactions/?date_from=${desde}&date_to=${hasta}`
    );
    return aMovimientos(js).movimientos;
  }
}
