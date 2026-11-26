import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { celdaNumero, celdaTexto } from "@/lib/csv";
import { detectarMime, decodificarJustificante, MAX_BYTES_JUSTIFICANTE } from "@/lib/archivos";
import { aCentimos, aEuros, formatoEs } from "@/lib/money";
import { hashPassword, hashToken, verifyPassword } from "@/lib/hash";
import { extraerMensajes, firmaValida } from "@/lib/whatsapp";
import { validarIdentificadorFiscal } from "@/lib/nif";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const PDF = Buffer.from("%PDF-1.7\n" + "x".repeat(16));
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(8)]);

describe("dinero en céntimos", () => {
  it("evita el error clásico de coma flotante", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(aCentimos(0.1) + aCentimos(0.2)).toBe(30);
  });

  it("redondea half-up y vuelve a euros sin deriva", () => {
    expect(aCentimos(1.005)).toBe(101);
    expect(aEuros(30)).toBe(0.3);
    expect(formatoEs(1234.5)).toBe("1234,50");
  });

  it("rechaza importes no finitos", () => {
    expect(() => aCentimos(Number.NaN)).toThrow();
    expect(() => aCentimos(Infinity)).toThrow();
  });
});

describe("CSV seguro para Excel", () => {
  it("neutraliza fórmulas inyectadas desde el emisor de un ticket", () => {
    expect(celdaTexto('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(celdaTexto("+SUMA(A1)")).toMatch(/^"'\+/);
    expect(celdaTexto("-1+1")).toMatch(/^"'-/);
    expect(celdaTexto("@cmd")).toMatch(/^"'@/);
  });

  it("escapa comillas y no toca texto normal", () => {
    expect(celdaTexto('Bar "El Cruce"')).toBe('"Bar ""El Cruce"""');
    expect(celdaTexto("Distribuciones Ferrallado, S.L.")).toBe('"Distribuciones Ferrallado, S.L."');
    expect(celdaTexto(null)).toBe('""');
  });

  it("formatea números con coma decimal", () => {
    expect(celdaNumero(121)).toBe("121,00");
    expect(celdaNumero(9.5)).toBe("9,50");
  });
});

describe("validación de justificantes por contenido", () => {
  it("detecta el tipo por firma binaria, no por extensión", () => {
    expect(detectarMime(PNG)).toBe("image/png");
    expect(detectarMime(JPG)).toBe("image/jpeg");
    expect(detectarMime(PDF)).toBe("application/pdf");
    expect(detectarMime(WEBP)).toBe("image/webp");
    expect(detectarMime(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
  });

  it("acepta data URL y base64 puro", () => {
    const b64 = PNG.toString("base64");
    const a = decodificarJustificante(`data:image/png;base64,${b64}`, "image/png");
    expect(a.ok).toBe(true);
    const b = decodificarJustificante(b64);
    expect(b.ok).toBe(true);
  });

  it("rechaza MIME declarado distinto del contenido", () => {
    const r = decodificarJustificante(PDF.toString("base64"), "image/png");
    expect(r.ok).toBe(false);
  });

  it("rechaza archivos demasiado grandes sin decodificarlos", () => {
    const grande = "A".repeat(Math.ceil((MAX_BYTES_JUSTIFICANTE * 4) / 3) + 100);
    const r = decodificarJustificante(grande);
    expect(r.ok).toBe(false);
  });

  it("rechaza base64 inválido y archivos vacíos", () => {
    expect(decodificarJustificante("no es base64!!").ok).toBe(false);
    expect(decodificarJustificante("").ok).toBe(false);
  });
});

describe("contraseñas y tokens", () => {
  it("verifica la contraseña correcta y rechaza las demás", async () => {
    const h = await hashPassword("clave-Segura1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("clave-Segura1", h)).toBe(true);
    expect(await verifyPassword("clave-Segura2", h)).toBe(false);
  });

  it("no acepta formatos de hash malformados", async () => {
    expect(await verifyPassword("x", "texto-plano")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });

  it("el hash de token es determinista y no revela el token", () => {
    const t = "token-de-prueba";
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toHaveLength(64);
  });
});

describe("webhook de WhatsApp", () => {
  const secreto = "app-secret-de-prueba";
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] });
  const firma = (c: string) => "sha256=" + createHmac("sha256", secreto).update(c).digest("hex");

  it("acepta solo firmas HMAC válidas del cuerpo exacto", () => {
    expect(firmaValida(cuerpo, firma(cuerpo), secreto)).toBe(true);
    expect(firmaValida(cuerpo + " ", firma(cuerpo), secreto)).toBe(false);
    expect(firmaValida(cuerpo, firma(cuerpo), "otro-secreto")).toBe(false);
    expect(firmaValida(cuerpo, null, secreto)).toBe(false);
    expect(firmaValida(cuerpo, "sha256=zz", secreto)).toBe(false);
  });

  it("extrae solo mensajes con adjuntos y normaliza el número", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.1", from: "+34 640 111 222", type: "image", image: { id: "media-1" } },
                  { id: "wamid.2", from: "34640111222", type: "text", text: { body: "hola" } },
                  { id: "wamid.3", from: "34640111222", type: "document", document: { id: "media-2", filename: "f.pdf" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const m = extraerMensajes(payload);
    expect(m).toHaveLength(3);
    expect(m[0]).toMatchObject({ wamid: "wamid.1", numero: "34640111222", mediaId: "media-1" });
    expect(m[1].mediaId).toBeNull();
    expect(m[2]).toMatchObject({ mediaId: "media-2", nombre: "f.pdf" });
  });

  it("ignora payloads de estado y basura sin lanzar", () => {
    expect(extraerMensajes({ entry: [{ changes: [{ value: { statuses: [] } }] }] })).toEqual([]);
    expect(extraerMensajes(null)).toEqual([]);
    expect(extraerMensajes({ entry: "x" })).toEqual([]);
  });
});

describe("validación NIF/CIF", () => {
  it("acepta NIF con letra correcta y rechaza la incorrecta", () => {
    expect(validarIdentificadorFiscal("12345678Z").valido).toBe(true);
    expect(validarIdentificadorFiscal("12345678A").valido).toBe(false);
  });

  it("normaliza espacios, guiones y prefijo ES", () => {
    expect(validarIdentificadorFiscal("es 12345678-z").normalizado).toBe("12345678Z");
  });

  it("valida el dígito de control del CIF", () => {
    expect(validarIdentificadorFiscal("B46283917").valido).toBe(true);
    expect(validarIdentificadorFiscal("A28547963").valido).toBe(false);
  });
});

describe("variantesNumero (WhatsApp Brasil)", () => {
  it("acepta el móvil brasileño con y sin el 9", async () => {
    const { variantesNumero } = await import("../whatsapp");
    expect(variantesNumero("5518996426306")).toEqual(["5518996426306", "551896426306"]);
    expect(variantesNumero("551896426306")).toEqual(["551896426306", "5518996426306"]);
  });
  it("no toca los números de otros países ni los fijos brasileños", async () => {
    const { variantesNumero } = await import("../whatsapp");
    expect(variantesNumero("34600111222")).toEqual(["34600111222"]);
    expect(variantesNumero("551832221111")).toEqual(["551832221111"]);
  });
});
