import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { base32Decode, base32Encode, codigoTotp, nuevoSecreto, uriOtpauth, verificarTotp } from "@/lib/totp";

// RFC 6238, apéndice B: secreto ASCII "12345678901234567890", SHA-1.
const SECRETO_RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("el secreto de la RFC se codifica en base32 y vuelve igual", () => {
    expect(SECRETO_RFC).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(SECRETO_RFC).toString()).toBe("12345678901234567890");
  });

  it("coincide con los vectores de prueba oficiales (6 dígitos)", () => {
    const vectores: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
    ];
    for (const [t, esperado] of vectores) {
      expect(codigoTotp(SECRETO_RFC, Math.floor(t / 30))).toBe(esperado);
    }
  });

  it("acepta el código vigente y los desfases de ±1 intervalo", () => {
    const ahora = 1_700_000_000_000;
    const paso = Math.floor(ahora / 30000);
    for (const delta of [-1, 0, 1]) {
      const c = codigoTotp(SECRETO_RFC, paso + delta);
      expect(verificarTotp(SECRETO_RFC, c, { ahoraMs: ahora })).toBe(paso + delta);
    }
  });

  it("rechaza códigos de otro intervalo, mal formados y secretos distintos", () => {
    const ahora = 1_700_000_000_000;
    const paso = Math.floor(ahora / 30000);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso + 5), { ahoraMs: ahora })).toBeNull();
    expect(verificarTotp(SECRETO_RFC, "12345", { ahoraMs: ahora })).toBeNull();
    expect(verificarTotp(SECRETO_RFC, "abcdef", { ahoraMs: ahora })).toBeNull();
    expect(verificarTotp(nuevoSecreto(), codigoTotp(SECRETO_RFC, paso), { ahoraMs: ahora })).toBeNull();
  });

  it("impide reutilizar un código ya aceptado", () => {
    const ahora = 1_700_000_000_000;
    const paso = Math.floor(ahora / 30000);
    const c = codigoTotp(SECRETO_RFC, paso);
    expect(verificarTotp(SECRETO_RFC, c, { ahoraMs: ahora })).toBe(paso);
    expect(verificarTotp(SECRETO_RFC, c, { ahoraMs: ahora, ultimoPaso: paso })).toBeNull();
  });

  it("genera la URI otpauth con emisor y cuenta", () => {
    const uri = uriOtpauth("ABCDEFGH", "dueno@ejemplo.es");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=ABCDEFGH");
    expect(uri).toContain("issuer=TicketFiscal%20AI");
  });
});

describe("cifrado del secreto", () => {
  beforeAll(() => {
    process.env.ADMIN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.STORAGE_POSTGRES_PRISMA_URL = "postgresql://x/y";
  });

  it("cifra y descifra, y cada cifrado es distinto", async () => {
    const { cifrar, descifrar } = await import("@/lib/cifrado");
    const a = cifrar("SECRETO");
    const b = cifrar("SECRETO");
    expect(a).not.toBe(b);
    expect(a).not.toContain("SECRETO");
    expect(descifrar(a)).toBe("SECRETO");
  });

  it("detecta manipulación del texto cifrado", async () => {
    const { cifrar, descifrar } = await import("@/lib/cifrado");
    const t = cifrar("SECRETO").split(".");
    t[3] = Buffer.from("otro-contenido").toString("base64url");
    expect(() => descifrar(t.join("."))).toThrow();
  });
});
