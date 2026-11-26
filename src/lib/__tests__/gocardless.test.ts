import { describe, expect, it, vi } from "vitest";
import { aMovimientos, GoCardless } from "../banca/gocardless";
import { ProveedorBancarioNoDisponible } from "../banca/proveedor";

const respuesta = {
  transactions: {
    booked: [
      { transactionId: "T1", bookingDate: "2026-07-15", transactionAmount: { amount: "-24.00", currency: "EUR" }, remittanceInformationUnstructured: "COMPRA TARJ  BAR EL CRUCE" },
      { internalTransactionId: "I2", valueDate: "2026-07-18", transactionAmount: { amount: "-56.10", currency: "EUR" }, creditorName: "Estación de Servicio La Vía" },
      { bookingDate: "2026-07-20", transactionAmount: { amount: "1000.00", currency: "EUR" }, debtorName: "Cliente SL" },
      { bookingDate: "2026-07-20", transactionAmount: { amount: "1000.00", currency: "EUR" }, debtorName: "Cliente SL" },
      { transactionId: "T9", bookingDate: "2026-07-21", transactionAmount: { amount: "-10.00", currency: "USD" }, remittanceInformationUnstructured: "Compra en dólares" },
      { transactionId: "T10", bookingDate: "no-es-fecha", transactionAmount: { amount: "-1.00", currency: "EUR" } },
    ],
    pending: [{ transactionId: "P1", bookingDate: "2026-07-22", transactionAmount: { amount: "-5.00", currency: "EUR" } }],
  },
};

describe("GoCardless: mapeo de transacciones", () => {
  const r = aMovimientos(respuesta);

  it("convierte importes a céntimos y usa solo los apuntes contabilizados", () => {
    expect(r.movimientos.map((m) => m.importeCent)).toEqual([-2400, -5610, 100000, 100000]);
    expect(r.movimientos.some((m) => m.descripcion.includes("5.00"))).toBe(false);
  });
  it("ignora divisas distintas del euro y fechas inválidas, y lo cuenta", () => {
    expect(r.ignoradas).toBe(2);
  });
  it("limpia el concepto y usa la contraparte si no hay concepto", () => {
    expect(r.movimientos[0].descripcion).toBe("COMPRA TARJ BAR EL CRUCE");
    expect(r.movimientos[1].descripcion).toBe("Estación de Servicio La Vía");
    expect(r.movimientos[2].descripcion).toBe("Cliente SL");
  });
  it("da ids estables: los del banco con prefijo y, sin ellos, uno distinto por ocurrencia", () => {
    expect(r.movimientos[0].idExterno).toBe("gc:T1");
    expect(r.movimientos[1].idExterno).toBe("gc:I2");
    expect(r.movimientos[2].idExterno).not.toBe(r.movimientos[3].idExterno);
    expect(aMovimientos(respuesta).movimientos.map((m) => m.idExterno)).toEqual(r.movimientos.map((m) => m.idExterno));
  });
  it("tolera una respuesta vacía", () => {
    expect(aMovimientos({})).toEqual({ movimientos: [], ignoradas: 0 });
  });
});

function http(respuestas: Array<{ status?: number; json: unknown }>) {
  const f = vi.fn(async () => {
    const r = respuestas.shift()!;
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  });
  return f as unknown as typeof fetch & typeof f;
}

describe("GoCardless: cliente", () => {
  const cred = { secretId: "id-de-prueba", secretKey: "clave-de-prueba" };

  it("sin credenciales no está disponible y no llama a la red", async () => {
    const f = http([]);
    const g = new GoCardless({}, f);
    expect(g.disponible()).toBe(false);
    await expect(g.listarInstituciones("es")).rejects.toBeInstanceOf(ProveedorBancarioNoDisponible);
    expect(f).not.toHaveBeenCalled();
  });

  it("obtiene un token una vez y lo reutiliza", async () => {
    const f = http([
      { json: { access: "TOKEN", access_expires: 86400 } },
      { json: [{ id: "BANCO_ES", name: "Banco de prueba", transaction_total_days: "730" }] },
      { json: [] },
    ]);
    const g = new GoCardless(cred, f);
    const inst = await g.listarInstituciones("ES");
    expect(inst).toEqual([{ id: "BANCO_ES", nombre: "Banco de prueba", diasHistorico: 730 }]);
    await g.listarInstituciones("ES");
    expect(f).toHaveBeenCalledTimes(3); // 1 token + 2 consultas
  });

  it("traduce el estado de la conexión y devuelve las cuentas", async () => {
    const g = new GoCardless(cred, http([{ json: { access: "T", access_expires: 3600 } }, { json: { status: "LN", accounts: ["A1", "A2"] } }]));
    expect(await g.estadoConexion("REQ1")).toEqual({ estado: "ACTIVA", cuentas: ["A1", "A2"] });
  });

  it("credenciales rechazadas y límite de consultas dan un error explícito", async () => {
    await expect(new GoCardless(cred, http([{ status: 401, json: {} }])).listarInstituciones("es")).rejects.toThrow(/rechazó las credenciales/);
    const g = new GoCardless(cred, http([{ json: { access: "T" } }, { status: 429, json: {} }]));
    await expect(g.listarInstituciones("es")).rejects.toThrow(/límite de consultas/);
  });

  it("valida país y fechas antes de llamar", async () => {
    const g = new GoCardless(cred, http([]));
    await expect(g.listarInstituciones("españa")).rejects.toThrow();
    await expect(g.movimientos("A1", "ayer", "2026-01-01")).rejects.toThrow();
  });
});
