"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Building2, ClipboardList, Copy, Gauge, Loader2, LockKeyhole, Settings, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProveedorAdmin } from "./api";
import { SeccionEmpresas, SeccionGestorias, SeccionUsuarios } from "./secciones-cuentas";
import { SeccionAuditoria, SeccionConfiguracion, SeccionResumen, SeccionSeguridad } from "./secciones-sistema";

type Fase = "cargando" | "bootstrap" | "login" | "totp" | "enrolar" | "panel";

interface SesionAdmin {
  usuario: { nombre: string; email: string };
  estadoTotp: "sin_configurar" | "pendiente" | "activo";
  segundoFactorVerificado: boolean;
  emailSegundoFactor: boolean;
}

async function api<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<{ ok: boolean; estado: number; datos: T & { error?: string } }> {
  try {
    const res = await fetch(ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    });
    let datos: unknown = {};
    try {
      datos = await res.json();
    } catch {
      datos = {};
    }
    return { ok: res.ok, estado: res.status, datos: datos as T & { error?: string } };
  } catch {
    return { ok: false, estado: 0, datos: { error: "Error de conexión" } as T & { error?: string } };
  }
}

function Marco({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-800">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Administración · TicketFiscal AI</span>
          </div>
          <CardTitle className="font-serif text-2xl">{titulo}</CardTitle>
          {descripcion && <CardDescription>{descripcion}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}

function Campo({ id, etiqueta, ...props }: { id: string; etiqueta: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

// ------------------------------------------------------------------ Pantallas de acceso

function PrimerAcceso({ onHecho }: { onHecho: () => void }) {
  const [v, setV] = useState({ token: "", email: "", nombre: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    setError(null);
    const r = await api("/api/admin/bootstrap", "POST", v);
    setEnviando(false);
    if (r.ok) {
      toast({ title: "Cuenta de administrador creada" });
      onHecho();
    } else setError(r.datos.error ?? "No se pudo crear la cuenta");
  }

  return (
    <Marco titulo="Primer acceso" descripcion="Cree la cuenta del dueño del sistema. Solo funciona una vez y solo con el e-mail y el token pre-aprobados.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <Campo id="bs-token" etiqueta="Token de primer acceso" type="password" autoComplete="off" value={v.token} onChange={(e) => setV({ ...v, token: e.target.value })} />
        <Campo id="bs-email" etiqueta="E-mail pre-aprobado" type="email" autoComplete="username" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <Campo id="bs-nombre" etiqueta="Nombre completo" value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} />
        <Campo id="bs-pass" etiqueta="Contraseña (mín. 12, con letras y números)" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear cuenta
        </Button>
      </form>
    </Marco>
  );
}

function Acceso({ onSiguiente }: { onSiguiente: (estado: SesionAdmin["estadoTotp"]) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setEnviando(true);
    setError(null);
    const r = await api<{ estadoTotp: SesionAdmin["estadoTotp"] }>("/api/admin/auth/login", "POST", { email, password });
    setEnviando(false);
    if (r.ok) onSiguiente(r.datos.estadoTotp);
    else setError(r.estado === 429 ? "Demasiados intentos. Espere unos minutos." : (r.datos.error ?? "No se pudo iniciar sesión"));
  }

  return (
    <Marco titulo="Acceso del administrador" descripcion="Acceso restringido. Se le pedirá el código de su aplicación autenticadora.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <Campo id="ad-email" etiqueta="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo id="ad-pass" etiqueta="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={enviando || !email || !password}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuar
        </Button>
      </form>
    </Marco>
  );
}

function CodigoTotp({ onHecho, onVolver }: { onHecho: () => void; onVolver: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function verificar() {
    setEnviando(true);
    setError(null);
    const r = await api("/api/admin/auth/totp", "POST", { codigo: codigo.trim() });
    setEnviando(false);
    if (r.ok) onHecho();
    else setError(r.estado === 429 ? "Demasiados intentos. Espere unos minutos." : "Código incorrecto o ya usado. Espere al siguiente código.");
  }

  return (
    <Marco titulo="Verificación en dos pasos" descripcion="Introduzca el código de 6 dígitos de su aplicación autenticadora, o un código de recuperación.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void verificar();
        }}
      >
        <Campo id="totp" etiqueta="Código" inputMode="numeric" autoComplete="one-time-code" autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="000000" />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={enviando || codigo.trim().length < 6}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verificar
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onVolver}>
          Usar otra cuenta
        </Button>
      </form>
    </Marco>
  );
}

function ConfigurarAutenticador({ onHecho }: { onHecho: () => void }) {
  const [datos, setDatos] = useState<{ secreto: string; qr: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [respaldo, setRespaldo] = useState<string[] | null>(null);

  useEffect(() => {
    let activo = true;
    void api<{ secreto: string; qr: string }>("/api/admin/auth/enrolar", "POST").then((r) => {
      if (!activo) return;
      if (r.ok) setDatos(r.datos);
      else setError(r.datos.error ?? "No se pudo iniciar la configuración");
    });
    return () => {
      activo = false;
    };
  }, []);

  async function activar() {
    setEnviando(true);
    setError(null);
    const r = await api<{ codigosRespaldo: string[] }>("/api/admin/auth/enrolar", "PUT", { codigo: codigo.trim() });
    setEnviando(false);
    if (r.ok) setRespaldo(r.datos.codigosRespaldo);
    else setError("Código incorrecto. Compruebe que la hora de su móvil es automática.");
  }

  if (respaldo) {
    return (
      <Marco titulo="Guarde sus códigos de recuperación" descripcion="Cada código vale una sola vez y es la única forma de entrar si pierde el móvil. No se volverán a mostrar.">
        <div className="space-y-4">
          <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/50 p-3 font-mono text-sm">
            {respaldo.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              void navigator.clipboard?.writeText(respaldo.join("\n"));
              toast({ title: "Códigos copiados" });
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar códigos
          </Button>
          <Button type="button" className="w-full" onClick={onHecho}>
            Los he guardado, continuar
          </Button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco titulo="Configure su autenticador" descripcion="Escanee el código QR con Google Authenticator (o Authy, 1Password…) y escriba el código que muestra.">
      <div className="space-y-4">
        {datos ? (
          <>
            <img src={datos.qr} alt="Código QR para la aplicación autenticadora" className="mx-auto h-48 w-48 rounded-md border bg-white p-2" />
            <p className="break-all text-center font-mono text-[11px] text-muted-foreground">Clave manual: {datos.secreto}</p>
          </>
        ) : (
          !error && <div className="mx-auto h-48 w-48 animate-pulse rounded-md bg-muted" />
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void activar();
          }}
        >
          <Campo id="enr-codigo" etiqueta="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="000000" />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={enviando || !datos || codigo.trim().length < 6}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Activar
          </Button>
        </form>
      </div>
    </Marco>
  );
}

// ------------------------------------------------------------------ Panel

const SECCIONES = [
  { id: "resumen", etiqueta: "Resumen", icono: Gauge },
  { id: "gestorias", etiqueta: "Gestorías", icono: Building2 },
  { id: "usuarios", etiqueta: "Usuarios", icono: Users },
  { id: "empresas", etiqueta: "Empresas", icono: Building2 },
  { id: "auditoria", etiqueta: "Auditoría", icono: ClipboardList },
  { id: "configuracion", etiqueta: "Configuración", icono: Settings },
  { id: "seguridad", etiqueta: "Seguridad", icono: LockKeyhole },
] as const;

type IdSeccion = (typeof SECCIONES)[number]["id"];

function Panel({ nombre, onSalir }: { nombre: string; onSalir: () => void }) {
  const [seccion, setSeccion] = useState<IdSeccion>("resumen");
  const [filtroGestorias, setFiltroGestorias] = useState("todos");
  const actual = SECCIONES.find((s) => s.id === seccion)!;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-[#0b1f3a] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-serif text-base font-semibold">TicketFiscal AI</span>
            <span className="hidden text-xs uppercase tracking-wider text-white/60 sm:inline">Administración</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-white/70 sm:inline">{nombre}</span>
            <Button size="sm" variant="secondary" className="h-8" onClick={onSalir}>
              Salir
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              aria-current={s.id === seccion ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition",
                s.id === seccion ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <s.icono className="h-3.5 w-3.5" /> {s.etiqueta}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <h1 className="font-serif text-2xl font-semibold">{actual.etiqueta}</h1>
        {seccion === "resumen" && (
          <SeccionResumen
            onIr={(s) => {
              if (s === "gestorias") setFiltroGestorias("PENDIENTE");
              setSeccion(s as IdSeccion);
            }}
          />
        )}
        {seccion === "gestorias" && <SeccionGestorias key={filtroGestorias} estadoInicial={filtroGestorias} />}
        {seccion === "usuarios" && <SeccionUsuarios />}
        {seccion === "empresas" && <SeccionEmpresas />}
        {seccion === "auditoria" && <SeccionAuditoria />}
        {seccion === "configuracion" && <SeccionConfiguracion />}
        {seccion === "seguridad" && <SeccionSeguridad onSalir={onSalir} />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ Raíz

export function AdminApp() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [sesion, setSesion] = useState<SesionAdmin | null>(null);

  /** Determina en qué paso del acceso está el usuario según el servidor. */
  const resolver = useCallback(async (): Promise<{ fase: Fase; sesion: SesionAdmin | null }> => {
    const r = await api<SesionAdmin>("/api/admin/auth/session");
    if (r.ok) {
      return { sesion: r.datos, fase: r.datos.segundoFactorVerificado ? "panel" : r.datos.estadoTotp === "activo" ? "totp" : "enrolar" };
    }
    const b = await api("/api/admin/bootstrap");
    return { sesion: null, fase: b.ok ? "bootstrap" : "login" };
  }, []);

  const cargar = useCallback(async () => {
    const r = await resolver();
    setSesion(r.sesion);
    setFase(r.fase);
  }, [resolver]);

  // Carga inicial: el estado se actualiza dentro de .then, no de forma síncrona en el efecto.
  useEffect(() => {
    let activo = true;
    void resolver().then((r) => {
      if (!activo) return;
      setSesion(r.sesion);
      setFase(r.fase);
    });
    return () => {
      activo = false;
    };
  }, [resolver]);

  async function salir() {
    await api("/api/admin/auth/logout", "POST");
    setSesion(null);
    setFase("login");
  }

  if (fase === "cargando") {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (fase === "bootstrap") return <PrimerAcceso onHecho={() => setFase("login")} />;
  if (fase === "login") return <Acceso onSiguiente={() => void cargar()} />;
  if (fase === "totp") return <CodigoTotp onHecho={() => void cargar()} onVolver={() => void salir()} />;
  if (fase === "enrolar") return <ConfigurarAutenticador onHecho={() => void cargar()} />;

  return (
    <ProveedorAdmin emailSegundoFactor={sesion?.emailSegundoFactor ?? false}>
      <Panel nombre={sesion?.usuario.nombre ?? ""} onSalir={() => void salir()} />
    </ProveedorAdmin>
  );
}
