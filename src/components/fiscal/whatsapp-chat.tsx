"use client";

import { eur } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Paperclip, Send, Check, CheckCheck, Bot, User, Loader2, AlertTriangle, FileText, BadgeCheck, ShieldAlert } from "lucide-react";
import { MUESTRAS, type Documento } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Rol = "cliente" | "bot";

interface Mensaje {
  id: string;
  rol: Rol;
  texto?: string;
  imagenUrl?: string;
  esPdf?: boolean;
  nombreArchivo?: string;
  hora: string;
  estado?: "enviado" | "leido";
  doc?: Documento;
  simulado?: boolean;
  error?: boolean;
}

export interface ClienteChat {
  nombre: string;
  nif: string;
  empresaNombre: string;
  gestoriaNombre: string;
}

/** Descarga una imagen del servidor y la convierte en data URL base64. */
async function urlADataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function horaAhora(): string {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function WhatsAppChat({
  cliente,
  onDocumentoProcesado,
}: {
  cliente: ClienteChat;
  onDocumentoProcesado: () => void;
}) {
  const { toast } = useToast();
  const [saludo] = useState<Mensaje[]>(() => [
    {
      id: "m0",
      rol: "bot",
      texto: `Hola ${cliente.nombre.split(" ")[0]}! Soy el asistente fiscal de ${cliente.gestoriaNombre}. Mándame la foto de cualquier ticket o factura (o el PDF) de ${cliente.empresaNombre} y la registro al instante para tu contabilidad. No hace falta instalar nada.`,
      hora: "09:12",
      estado: "leido",
    },
  ]);
  const [mensajes, setMensajes] = useState<Mensaje[]>(saludo);
  const [procesando, setProcesando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(scrollToBottom, [scrollToBottom, mensajes, procesando]);

  async function enviarMuestra(muestra: (typeof MUESTRAS)[number]) {
    if (procesando) return;
    try {
      const dataUrl = await urlADataUrl(muestra.archivo);
      setMensajes((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          rol: "cliente",
          imagenUrl: muestra.archivo,
          nombreArchivo: muestra.titulo,
          hora: horaAhora(),
          estado: "enviado",
        },
      ]);
      await procesarDocumento(dataUrl, muestra.titulo);
    } catch {
      toast({
        title: "No se pudo cargar la muestra",
        description: "Inténtelo de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  }

  async function subirArchivo(file: File) {
    if (procesando) return;
    const esPdf = file.type === "application/pdf";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setMensajes((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        rol: "cliente",
        imagenUrl: esPdf ? undefined : dataUrl,
        esPdf,
        nombreArchivo: file.name,
        hora: horaAhora(),
        estado: "enviado",
      },
    ]);
    await procesarDocumento(dataUrl, file.name);
  }

  async function procesarDocumento(dataUrl: string, nombre: string) {
    setProcesando(true);
    setMensajes((m) => {
      const copia = [...m];
      for (let i = copia.length - 1; i >= 0; i--) {
        if (copia[i].rol === "cliente") {
          copia[i] = { ...copia[i], estado: "leido" };
          break;
        }
      }
      return copia;
    });

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          imagenNombre: nombre,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error de procesamiento");

      const doc: Documento = json.documento;
      const simulado = Boolean(json.simulado);
      await new Promise((r) => setTimeout(r, 600)); // pausa natural
      setMensajes((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          rol: "bot",
          texto: doc.mensajeWhatsapp || "He recibido su justificante y lo he registrado.",
          hora: horaAhora(),
          estado: "leido",
          doc,
          simulado,
        },
      ]);
      onDocumentoProcesado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      setMensajes((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          rol: "bot",
          texto: `Perdone, no he podido leer bien este justificante (${msg}). ¿Puede repetir la foto con el documento completo y bien iluminado?`,
          hora: horaAhora(),
          estado: "leido",
          error: true,
        },
      ]);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-16rem)] min-h-[480px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-sm">
      {/* Cabecera del chat */}
      <header className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "var(--wa-header)" }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{cliente.gestoriaNombre}</p>
          <p className="text-xs text-emerald-100">
            {procesando ? "leyendo el justificante…" : "en línea"}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium tracking-wide">
          Asistente fiscal
        </span>
      </header>

      {/* Zona de mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2.5 overflow-y-auto p-4"
        style={{ background: "var(--wa-bg)" }}
        aria-label="Conversación de WhatsApp"
      >
        {mensajes.map((m) => (
          <div key={m.id} className={cn("flex", m.rol === "cliente" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                m.rol === "cliente" ? "rounded-br-md text-gray-900" : "rounded-bl-md bg-white text-gray-900",
                m.error && "border border-red-200 bg-red-50"
              )}
              style={m.rol === "cliente" ? { background: "var(--wa-bubble)" } : undefined}
            >
              {m.rol === "cliente" && (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-900/70">
                  <User className="h-3 w-3" /> {cliente.nombre}
                </p>
              )}

              {m.esPdf ? (
                <div className="mb-1 flex items-center gap-2 rounded-lg bg-gray-100 p-2">
                  <FileText className="h-6 w-6 text-red-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{m.nombreArchivo}</p>
                    <p className="text-[10px] text-gray-500">Documento PDF</p>
                  </div>
                </div>
              ) : m.imagenUrl ? (
                <img
                  src={m.imagenUrl}
                  alt={`Justificante enviado: ${m.nombreArchivo ?? "ticket"}`}
                  className="mb-1 max-h-64 w-full rounded-lg object-cover"
                />
              ) : null}

              {m.texto && <p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>}

              {/* Tarjeta de datos extraídos */}
              {m.doc && <MiniaturaFiscal doc={m.doc} />}

              {m.simulado && (
                <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-800">
                  Modo demostración: este despliegue no tiene acceso al motor de IA y la respuesta
                  es una simulación preconfigurada de la muestra.
                </p>
              )}

              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                {m.hora}
                {m.rol === "cliente" &&
                  (m.estado === "leido" ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  ))}
              </p>
            </div>
          </div>
        ))}

        {procesando && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" aria-label="Procesando">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Selector de muestras + subida */}
      <div className="border-t bg-white px-3 py-3">
        <div className="mb-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Reenvíe uno de estos justificantes o suba el suyo:
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MUESTRAS.map((mu) => (
              <button
                key={mu.archivo}
                onClick={() => enviarMuestra(mu)}
                disabled={procesando}
                className="group overflow-hidden rounded-lg border bg-white text-left transition hover:border-primary/60 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <img
                  src={mu.archivo}
                  alt={mu.titulo}
                  className="h-20 w-full object-cover object-top transition group-hover:scale-105"
                />
                <div className="px-2 py-1.5">
                  <p className="truncate text-[11px] font-semibold">{mu.titulo}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{mu.descripcion}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirArchivo(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            aria-label="Adjuntar imagen o PDF"
          >
            {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </Button>
          <input
            disabled
            placeholder="La foto del ticket vale más que mil palabras…"
            className="h-10 flex-1 rounded-full border bg-muted/60 px-4 text-sm text-muted-foreground"
            aria-label="Mensaje (la foto del justificante basta)"
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            aria-label="Enviar justificante"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniaturaFiscal({ doc }: { doc: Documento }) {
  const color =
    doc.estado === "VALIDO"
      ? "border-emerald-300 bg-emerald-50"
      : doc.estado === "REQUIERE_REVISION"
        ? "border-amber-300 bg-amber-50"
        : "border-red-300 bg-red-50";

  return (
    <div className={cn("mt-2 rounded-lg border p-2.5 text-xs", color)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-800">
          {doc.tipoDocumento === "FACTURA_COMPLETA"
            ? "Factura completa"
            : doc.tipoDocumento === "FACTURA_SIMPLIFICADA"
              ? "Factura simplificada"
              : "No válido"}
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
          {doc.estado === "VALIDO" ? "Registrada" : doc.estado === "REQUIERE_REVISION" ? "A revisar" : "Ilegible"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-700">
        <div className="col-span-2 truncate">
          <dt className="inline font-medium">Emisor: </dt>
          <dd className="inline">{doc.emisorNombre ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Total: </dt>
          <dd className="inline font-bold">{eur(doc.totalFactura)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Base: </dt>
          <dd className="inline">{eur(doc.baseImponible)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">IVA {doc.porcentajeIva}%: </dt>
          <dd className="inline">{eur(doc.cuotaIva)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Deducible: </dt>
          <dd className="inline">{doc.ivaDeducible ? "Sí" : "No"}</dd>
        </div>
      </dl>
      {doc.nifEmisorValido === true && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
          <BadgeCheck className="h-3 w-3 shrink-0" /> NIF/CIF del emisor verificado (dígito de
          control determinístico)
        </p>
      )}
      {doc.nifEmisorValido === false && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-red-700">
          <ShieldAlert className="h-3 w-3 shrink-0" /> NIF/CIF del emisor inválido: detectado por
          el validador determinístico
        </p>
      )}
      {doc.motivoRevision && (
        <p className="mt-1.5 flex items-start gap-1 rounded bg-white/70 p-1.5 text-[10px] leading-snug text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {doc.motivoRevision}
        </p>
      )}
      <p className="mt-1.5 text-[10px] text-gray-500">
        Clasificada en la cuenta {doc.cuentaPgc} del PGC · en el lote de su gestoría
      </p>
    </div>
  );
}
