import { describe, expect, it } from "vitest";
import type { Config } from "@/lib/env";
import {
  construirPeticionGemini,
  construirPeticionGlm,
  costeEstimadoUsd,
  extraerRespuestaGemini,
  proveedorActivo,
  type ParteEntrada,
} from "@/lib/vision";

const PARTES: ParteEntrada[] = [
  { tipo: "texto", texto: "Analiza" },
  { tipo: "archivo", mime: "image/png", base64: "QUJD" },
];
const SYSTEM = "sistema";

describe("petición Gemini", () => {
  it("envía imagen como inline_data y el sistema como systemInstruction", () => {
    const body = construirPeticionGemini(SYSTEM, PARTES);
    expect(body.systemInstruction.parts[0].text).toBe(SYSTEM);
    expect(body.contents[0].parts[0]).toEqual({ text: "Analiza" });
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: "image/png", data: "QUJD" } });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0);
  });

  it("extrae texto y tokens; los de razonamiento cuentan como salida", () => {
    const r = extraerRespuestaGemini({
      candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }],
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 50 },
    });
    expect(r.texto).toBe('{"a":1}');
    expect(r.uso).toEqual({ entrada: 1000, salida: 250 });
  });

  it("ignora partes marcadas como pensamiento", () => {
    const r = extraerRespuestaGemini({
      candidates: [{ content: { parts: [{ text: "razonando", thought: true }, { text: '{"ok":true}' }] } }],
    });
    expect(r.texto).toBe('{"ok":true}');
  });

  it("bloqueo de seguridad o respuesta vacía son error definitivo", () => {
    expect(() => extraerRespuestaGemini({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/bloqueó/);
    expect(() => extraerRespuestaGemini({ candidates: [{ content: { parts: [] } }] })).toThrow(/no devolvió/);
  });
});

describe("petición GLM", () => {
  it("mantiene el formato OpenAI-compatible con file_url para PDF", () => {
    const body = construirPeticionGlm(SYSTEM, [...PARTES, { tipo: "archivo", mime: "application/pdf", base64: "UERG" }], "m");
    const contenido = body.messages[1].content as Array<Record<string, unknown>>;
    expect(contenido[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } });
    expect(contenido[2]).toEqual({ type: "file_url", file_url: { url: "data:application/pdf;base64,UERG" } });
  });
});

describe("selección de proveedor", () => {
  const base = { VISION_PROVIDER: "auto", ZAI_BASE_URL: undefined, ZAI_API_KEY: undefined, GEMINI_API_KEY: undefined } as unknown as Config;

  it("sin credenciales no hay proveedor", () => {
    expect(proveedorActivo(base)).toBeNull();
  });

  it("auto prefiere GLM si existe y si no Gemini", () => {
    expect(proveedorActivo({ ...base, GEMINI_API_KEY: "k".repeat(20) })).toBe("gemini");
    expect(proveedorActivo({ ...base, GEMINI_API_KEY: "k".repeat(20), ZAI_BASE_URL: "https://x.test", ZAI_API_KEY: "z" })).toBe("glm");
  });

  it("forzar un proveedor no usa el otro aunque exista", () => {
    const c = { ...base, VISION_PROVIDER: "gemini", ZAI_BASE_URL: "https://x.test", ZAI_API_KEY: "z" } as unknown as Config;
    expect(proveedorActivo(c)).toBeNull();
    expect(proveedorActivo({ ...c, GEMINI_API_KEY: "k".repeat(20) })).toBe("gemini");
  });
});

describe("coste", () => {
  it("calcula USD con tarifas por millón de tokens", () => {
    expect(costeEstimadoUsd({ entrada: 1_000_000, salida: 500_000 }, 1, 2)).toBeCloseTo(2, 10);
  });
  it("sin tarifas devuelve null (no se inventa precio)", () => {
    expect(costeEstimadoUsd({ entrada: 10, salida: 10 })).toBeNull();
  });
});

import { construirPeticionAnthropic, extraerRespuestaAnthropic } from "@/lib/vision";

describe("petición Anthropic (Claude)", () => {
  it("envía imagen como bloque image y PDF como bloque document, con system aparte", () => {
    const body = construirPeticionAnthropic(SYSTEM, [...PARTES, { tipo: "archivo", mime: "application/pdf", base64: "UERG" }], "claude-haiku-5-5");
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.system).toBe(SYSTEM);
    expect(body.temperature).toBe(0);
    const bloques = body.messages[0].content as Array<Record<string, unknown>>;
    expect(bloques[0]).toEqual({ type: "text", text: "Analiza" });
    expect(bloques[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } });
    expect(bloques[2]).toEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: "UERG" } });
  });

  it("extrae el texto de los bloques de texto y los tokens de uso", () => {
    const r = extraerRespuestaAnthropic({
      content: [{ type: "text", text: '{"a":' }, { type: "text", text: "1}" }],
      usage: { input_tokens: 3000, output_tokens: 500 },
    });
    expect(r.texto).toBe('{"a":1}');
    expect(r.uso).toEqual({ entrada: 3000, salida: 500 });
  });

  it("respuesta sin texto es error definitivo", () => {
    expect(() => extraerRespuestaAnthropic({ content: [] })).toThrow(/no devolvió/);
  });

  it("se selecciona cuando es el único proveedor con clave", () => {
    const base = { VISION_PROVIDER: "auto", ZAI_BASE_URL: undefined, ZAI_API_KEY: undefined, GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: "a".repeat(20) } as unknown as Config;
    expect(proveedorActivo(base)).toBe("anthropic");
    expect(proveedorActivo({ ...base, VISION_PROVIDER: "gemini" } as unknown as Config)).toBeNull();
  });
});
