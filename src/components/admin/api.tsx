"use client";

// Cliente de la API de administración. Si una acción sensible exige «step-up» (segundo factor
// reciente), abre un diálogo para pedir el código y repite la llamada automáticamente.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Respuesta<T> {
  ok: boolean;
  estado: number;
  datos: T & { error?: string; codigo?: string };
}

export type Llamar = <T = Record<string, unknown>>(
  ruta: string,
  opciones?: { metodo?: string; cuerpo?: unknown }
) => Promise<Respuesta<T>>;

interface ContextoAdmin {
  llamar: Llamar;
}

const Contexto = createContext<ContextoAdmin | null>(null);

export function useAdmin(): ContextoAdmin {
  const c = useContext(Contexto);
  if (!c) throw new Error("useAdmin fuera de ProveedorAdmin");
  return c;
}

async function peticion<T>(ruta: string, opciones?: { metodo?: string; cuerpo?: unknown }): Promise<Respuesta<T>> {
  try {
    const res = await fetch(ruta, {
      method: opciones?.metodo ?? "GET",
      headers: opciones?.cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opciones?.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      cache: "no-store",
    });
    let datos: unknown = {};
    try {
      datos = await res.json();
    } catch {
      datos = {};
    }
    return { ok: res.ok, estado: res.status, datos: datos as Respuesta<T>["datos"] };
  } catch {
    return { ok: false, estado: 0, datos: { error: "Error de conexión" } as Respuesta<T>["datos"] };
  }
}

export function ProveedorAdmin({ children, emailSegundoFactor }: { children: ReactNode; emailSegundoFactor: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigoEmail, setCodigoEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  const pedirStepUp = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setCodigo("");
        setCodigoEmail("");
        setError(null);
        setEmailEnviado(false);
        setAbierto(true);
      }),
    []
  );

  const llamar = useCallback<Llamar>(
    async (ruta, opciones) => {
      const r = await peticion<Record<string, unknown>>(ruta, opciones);
      if (r.estado === 403 && r.datos.codigo === "STEP_UP") {
        if (await pedirStepUp()) return peticion(ruta, opciones);
      }
      return r as never;
    },
    [pedirStepUp]
  );

  function cerrar(ok: boolean) {
    setAbierto(false);
    resolver.current?.(ok);
    resolver.current = null;
  }

  async function confirmar() {
    setVerificando(true);
    setError(null);
    const r = await peticion("/api/admin/auth/step-up", {
      metodo: "POST",
      cuerpo: { codigo: codigo.trim(), ...(emailSegundoFactor ? { codigoEmail: codigoEmail.trim() } : {}) },
    });
    setVerificando(false);
    if (r.ok) return cerrar(true);
    setError(
      r.estado === 429
        ? "Demasiados intentos. Espere unos minutos."
        : "Código incorrecto o ya usado. Espere al siguiente código de su aplicación (cambia cada 30 s)."
    );
  }

  async function enviarEmail() {
    const r = await peticion("/api/admin/auth/email-codigo", { metodo: "POST" });
    setEmailEnviado(r.ok);
    if (!r.ok) setError("No se pudo enviar el código por e-mail.");
  }

  const valor = useMemo(() => ({ llamar }), [llamar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Dialog open={abierto} onOpenChange={(o) => !o && cerrar(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <ShieldCheck className="h-5 w-5 text-emerald-700" /> Confirme su identidad
            </DialogTitle>
            <DialogDescription>
              Esta acción es sensible. Introduzca el código de 6 dígitos de su aplicación autenticadora (o un código de recuperación).
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmar();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="stepup-codigo">Código del autenticador</Label>
              <Input id="stepup-codigo" autoFocus inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="000000" />
            </div>
            {emailSegundoFactor && (
              <div className="space-y-1.5">
                <Label htmlFor="stepup-email">Código recibido por e-mail</Label>
                <div className="flex gap-2">
                  <Input id="stepup-email" inputMode="numeric" value={codigoEmail} onChange={(e) => setCodigoEmail(e.target.value)} placeholder="000000" />
                  <Button type="button" variant="outline" onClick={() => void enviarEmail()}>
                    {emailEnviado ? "Reenviar" : "Enviar"}
                  </Button>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => cerrar(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={verificando || codigo.trim().length < 6}>
                {verificando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Contexto.Provider>
  );
}

/**
 * Carga datos de una ruta. El estado de «cargando» se deriva (no se fija dentro del efecto):
 * cambiar la ruta o la versión vuelve a cargar.
 */
export function useDatos<T>(ruta: string | null, version = 0) {
  const { llamar } = useAdmin();
  const [estado, setEstado] = useState<{ ruta: string | null; version: number; datos: T | null; error: string | null }>({
    ruta: null,
    version: -1,
    datos: null,
    error: null,
  });

  useEffect(() => {
    if (!ruta) return;
    let activo = true;
    void llamar<T>(ruta).then((r) => {
      if (!activo) return;
      setEstado({ ruta, version, datos: r.ok ? (r.datos as T) : null, error: r.ok ? null : (r.datos.error ?? "Error al cargar") });
    });
    return () => {
      activo = false;
    };
  }, [ruta, version, llamar]);

  const cargando = ruta !== null && (estado.ruta !== ruta || estado.version !== version);
  return { datos: cargando ? null : estado.datos, error: cargando ? null : estado.error, cargando };
}
