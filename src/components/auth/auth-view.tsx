"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  UserRound,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Rol = "GESTOR" | "CLIENTE";

type DatosComunes = { nombre: string; email: string; password: string };

type DatosVies = {
  consultable: boolean;
  valido: boolean | null;
  nombre: string | null;
  direccion: string | null;
};

type RespuestaNif = {
  nif: string;
  formatoValido: boolean;
  motivo: string | null;
  vies: DatosVies;
};

type EstadoNif =
  | { fase: "inactivo" }
  | { fase: "consultando" }
  | { fase: "invalido"; motivo: string }
  | { fase: "valido"; vies: DatosVies }
  | { fase: "error" };

type GestoriaOpcion = { id: string | number; nombre: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Consulta de NIF/CIF con debounce de 600 ms                          */
/* ------------------------------------------------------------------ */

function useNifLookup(
  valor: string,
  onResultado?: (resultado: RespuestaNif) => void
): EstadoNif {
  const [estado, setEstado] = useState<EstadoNif>({ fase: "inactivo" });
  const callbackRef = useRef(onResultado);

  useEffect(() => {
    callbackRef.current = onResultado;
  });

  useEffect(() => {
    const nif = valor.trim().toUpperCase();

    if (nif.length < 8) {
      setEstado({ fase: "inactivo" });
      return;
    }

    setEstado({ fase: "consultando" });
    const controlador = new AbortController();

    const temporizador = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/nif/lookup?nif=${encodeURIComponent(nif)}`, {
            cache: "no-store",
            signal: controlador.signal,
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const datos = (await res.json()) as Partial<RespuestaNif> | null;
          if (!datos || typeof datos.formatoValido !== "boolean") {
            throw new Error("Respuesta no válida");
          }
          if (!datos.formatoValido) {
            setEstado({
              fase: "invalido",
              motivo: datos.motivo ?? "El formato del NIF/CIF no es válido.",
            });
          } else {
            setEstado({
              fase: "valido",
              vies: datos.vies ?? {
                consultable: false,
                valido: null,
                nombre: null,
                direccion: null,
              },
            });
          }
          callbackRef.current?.(datos as RespuestaNif);
        } catch {
          if (!controlador.signal.aborted) {
            setEstado({ fase: "error" });
          }
        }
      })();
    }, 600);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [valor]);

  return estado;
}

function MensajeNif({ estado }: { estado: EstadoNif }) {
  switch (estado.fase) {
    case "consultando":
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Consultando censo VIES…
        </p>
      );
    case "invalido":
      return (
        <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {estado.motivo}
        </p>
      );
    case "valido":
      if (!estado.vies.consultable) {
        return (
          <p className="flex items-start gap-1.5 text-xs text-emerald-700">
            <BadgeCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Dígito de control correcto · censo VIES no disponible ahora mismo
          </p>
        );
      }
      if (estado.vies.valido) {
        return (
          <p className="flex items-start gap-1.5 text-xs text-emerald-700">
            <BadgeCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {estado.vies.nombre
              ? `«${estado.vies.nombre}» — datos registrados en VIES`
              : "Dígito de control correcto · datos registrados en VIES"}
          </p>
        );
      }
      return (
        <p className="flex items-start gap-1.5 text-xs text-emerald-700">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Dígito de control correcto · no registrada en VIES (habitual en autónomos sin operaciones
          intracomunitarias)
        </p>
      );
    case "error":
      return (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          No se pudo verificar el NIF ahora mismo. Podrá completar el registro igualmente.
        </p>
      );
    case "inactivo":
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Campos reutilizables                                               */
/* ------------------------------------------------------------------ */

function CampoPassword({
  id,
  valor,
  onChange,
  autoComplete,
  ariaDescribedBy,
}: {
  id: string;
  valor: string;
  onChange: (valor: string) => void;
  autoComplete?: string;
  ariaDescribedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-describedby={ariaDescribedBy}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function CamposComunes({
  datos,
  onCambio,
}: {
  datos: DatosComunes;
  onCambio: (cambios: Partial<DatosComunes>) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="registro-nombre">Nombre y apellidos</Label>
        <Input
          id="registro-nombre"
          value={datos.nombre}
          onChange={(e) => onCambio({ nombre: e.target.value })}
          placeholder="Ana Martínez Serrano"
          autoComplete="name"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="registro-email">Email</Label>
        <Input
          id="registro-email"
          type="email"
          value={datos.email}
          onChange={(e) => onCambio({ email: e.target.value })}
          placeholder="nombre@gestoria.es"
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="registro-password">Contraseña</Label>
        <CampoPassword
          id="registro-password"
          valor={datos.password}
          onChange={(password) => onCambio({ password })}
          autoComplete="new-password"
          ariaDescribedBy="registro-password-ayuda"
        />
        <p id="registro-password-ayuda" className="text-xs text-muted-foreground">
          Mínimo 8 caracteres
        </p>
      </div>
    </>
  );
}

function validarComun({ nombre, email, password }: DatosComunes): string | null {
  if (!nombre.trim()) {
    return "Introduzca su nombre y apellidos.";
  }
  if (!EMAIL_RE.test(email.trim())) {
    return "Introduzca un email válido.";
  }
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  return null;
}

async function leerErrorPeticion(res: Response, fallback: string): Promise<string> {
  try {
    const datos = (await res.json()) as { error?: string; mensaje?: string } | null;
    return datos?.error ?? datos?.mensaje ?? fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Paso 1 del registro: selección de perfil                            */
/* ------------------------------------------------------------------ */

function TarjetaPerfil({
  icono: Icono,
  valor,
  titulo,
  descripcion,
  seleccionado,
  onElegir,
}: {
  icono: LucideIcon;
  valor: Rol;
  titulo: string;
  descripcion: string;
  seleccionado: boolean;
  onElegir: (rol: Rol) => void;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col rounded-lg border p-4 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        seleccionado ? "border-primary bg-primary/5" : "hover:bg-accent/50"
      )}
    >
      <input
        type="radio"
        name="rol"
        value={valor}
        checked={seleccionado}
        onChange={() => onElegir(valor)}
        className="sr-only"
      />
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg border",
          seleccionado
            ? "border-primary/30 bg-primary/10 text-primary"
            : "bg-secondary/60 text-muted-foreground"
        )}
        aria-hidden="true"
      >
        <Icono className="size-5" />
      </span>
      <span className="mt-3 text-sm font-semibold leading-snug">{titulo}</span>
      <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{descripcion}</span>
      <Check
        className={cn(
          "absolute right-3 top-3 size-4 text-primary transition-opacity",
          seleccionado ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
    </label>
  );
}

function SeleccionPerfil({
  rol,
  onElegir,
  onContinuar,
}: {
  rol: Rol | null;
  onElegir: (rol: Rol) => void;
  onContinuar: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium">¿Qué tipo de cuenta necesita?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <TarjetaPerfil
            icono={Building2}
            valor="GESTOR"
            titulo="Gestoría o asesoría"
            descripcion="Panel multi-empresa, validación AEAT y exportación contable"
            seleccionado={rol === "GESTOR"}
            onElegir={onElegir}
          />
          <TarjetaPerfil
            icono={UserRound}
            valor="CLIENTE"
            titulo="Empresa o autónomo"
            descripcion="Envío de tickets y facturas por WhatsApp a su gestoría"
            seleccionado={rol === "CLIENTE"}
            onElegir={onElegir}
          />
        </div>
      </fieldset>
      <Button type="button" onClick={onContinuar} disabled={rol === null}>
        Continuar
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formularios                                                        */
/* ------------------------------------------------------------------ */

type PropsFormularioRol = {
  comun: DatosComunes;
  onCambioComun: (cambios: Partial<DatosComunes>) => void;
  onSuccess: () => void;
  onVolverAPerfil: () => void;
};

function AlertaError({ mensaje }: { mensaje: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  );
}

function FormularioLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Introduzca su email y contraseña.");
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        cache: "no-store",
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      setError(
        await leerErrorPeticion(res, "No se pudo iniciar sesión. Compruebe sus datos e inténtelo de nuevo.")
      );
    } catch {
      setError("Error de conexión. Compruebe su red e inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {error ? <AlertaError mensaje={error} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@gestoria.es"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <CampoPassword
          id="login-password"
          valor={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" disabled={cargando} className="mt-1">
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}

function FormularioGestor({ comun, onCambioComun, onSuccess, onVolverAPerfil }: PropsFormularioRol) {
  const [gestoriaNombre, setGestoriaNombre] = useState("");
  const [nombreEditado, setNombreEditado] = useState(false);
  const [cif, setCif] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoCif = useNifLookup(cif, (resultado) => {
    if (resultado.formatoValido && resultado.vies.valido && resultado.vies.nombre && !nombreEditado) {
      setGestoriaNombre(resultado.vies.nombre);
    }
  });

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const fallo =
      validarComun(comun) ??
      (!gestoriaNombre.trim() ? "Introduzca el nombre de la gestoría." : null) ??
      (!cif.trim() ? "Introduzca el CIF de la gestoría." : null) ??
      (estadoCif.fase === "invalido"
        ? "El CIF de la gestoría no es válido. Revise el dígito de control."
        : null);

    if (fallo) {
      setError(fallo);
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol: "GESTOR",
          nombre: comun.nombre.trim(),
          email: comun.email.trim().toLowerCase(),
          password: comun.password,
          gestoriaNombre: gestoriaNombre.trim(),
          gestoriaCif: cif.trim().toUpperCase(),
        }),
        cache: "no-store",
      });
      if (res.status === 201) {
        onSuccess();
        return;
      }
      setError(await leerErrorPeticion(res, "No se pudo crear la cuenta. Inténtelo de nuevo en unos momentos."));
    } catch {
      setError("Error de conexión. Compruebe su red e inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {error ? <AlertaError mensaje={error} /> : null}

      <CamposComunes datos={comun} onCambio={onCambioComun} />

      <Separator />

      <div className="flex flex-col gap-2">
        <Label htmlFor="gestoria-nombre">Nombre de la gestoría</Label>
        <Input
          id="gestoria-nombre"
          value={gestoriaNombre}
          onChange={(e) => {
            setNombreEditado(true);
            setGestoriaNombre(e.target.value);
          }}
          placeholder="Asesoría Martínez & Asociados, S.L."
          autoComplete="organization"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gestoria-cif">CIF de la gestoría</Label>
        <Input
          id="gestoria-cif"
          value={cif}
          onChange={(e) => setCif(e.target.value.toUpperCase())}
          placeholder="B12345678"
          className="uppercase"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          aria-describedby="gestoria-cif-estado"
          aria-invalid={estadoCif.fase === "invalido"}
        />
        <div id="gestoria-cif-estado" aria-live="polite">
          <MensajeNif estado={estadoCif} />
        </div>
      </div>

      <Button type="submit" disabled={cargando} className="mt-1">
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Creando cuenta…
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onVolverAPerfil}
        className="mx-auto text-muted-foreground"
      >
        <ArrowLeft aria-hidden="true" />
        Cambiar de tipo de cuenta
      </Button>
    </form>
  );
}

function FormularioCliente({ comun, onCambioComun, onSuccess, onVolverAPerfil }: PropsFormularioRol) {
  const [nif, setNif] = useState("");
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [empresaNombreEditado, setEmpresaNombreEditado] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [direccionEditado, setDireccionEditado] = useState(false);
  const [ciudad, setCiudad] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [gestorias, setGestorias] = useState<GestoriaOpcion[]>([]);
  const [gestoriaId, setGestoriaId] = useState<string>("sin");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const res = await fetch("/api/gestorias", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const datos = (await res.json()) as { gestorias?: GestoriaOpcion[] } | null;
        if (activo && Array.isArray(datos?.gestorias)) {
          setGestorias(datos.gestorias);
        }
      } catch {
        // Sin lista disponible: el alta directa sigue siendo posible.
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const estadoNif = useNifLookup(nif, (resultado) => {
    if (!resultado.formatoValido || !resultado.vies.valido) {
      return;
    }
    if (resultado.vies.nombre && !empresaNombreEditado) {
      setEmpresaNombre(resultado.vies.nombre);
    }
    if (resultado.vies.direccion && !direccionEditado) {
      setDireccion(resultado.vies.direccion);
    }
  });

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const fallo =
      validarComun(comun) ??
      (!nif.trim() ? "Introduzca el NIF/CIF de la empresa." : null) ??
      (estadoNif.fase === "invalido"
        ? "El NIF/CIF de la empresa no es válido. Revise el dígito de control."
        : null) ??
      (!empresaNombre.trim() ? "Introduzca el nombre de la empresa." : null);

    if (fallo) {
      setError(fallo);
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol: "CLIENTE",
          nombre: comun.nombre.trim(),
          email: comun.email.trim().toLowerCase(),
          password: comun.password,
          nif: nif.trim().toUpperCase(),
          empresaNombre: empresaNombre.trim(),
          direccion: direccion.trim(),
          ciudad: ciudad.trim(),
          whatsapp: whatsapp.trim(),
          gestoriaId: gestoriaId === "sin" ? null : gestoriaId,
        }),
        cache: "no-store",
      });
      if (res.status === 201) {
        onSuccess();
        return;
      }
      setError(await leerErrorPeticion(res, "No se pudo crear la cuenta. Inténtelo de nuevo en unos momentos."));
    } catch {
      setError("Error de conexión. Compruebe su red e inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {error ? <AlertaError mensaje={error} /> : null}

      <CamposComunes datos={comun} onCambio={onCambioComun} />

      <Separator />

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-nif">NIF/CIF de la empresa</Label>
        <Input
          id="cliente-nif"
          value={nif}
          onChange={(e) => setNif(e.target.value.toUpperCase())}
          placeholder="B12345678"
          className="uppercase"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          aria-describedby="cliente-nif-estado"
          aria-invalid={estadoNif.fase === "invalido"}
        />
        <div id="cliente-nif-estado" aria-live="polite">
          <MensajeNif estado={estadoNif} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-empresa">Nombre de la empresa</Label>
        <Input
          id="cliente-empresa"
          value={empresaNombre}
          onChange={(e) => {
            setEmpresaNombreEditado(true);
            setEmpresaNombre(e.target.value);
          }}
          placeholder="Taller Pérez, S.L."
          autoComplete="organization"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-direccion">Domicilio</Label>
        <Input
          id="cliente-direccion"
          value={direccion}
          onChange={(e) => {
            setDireccionEditado(true);
            setDireccion(e.target.value);
          }}
          placeholder="Calle Mayor, 1 · 2ºA"
          autoComplete="street-address"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-ciudad">Ciudad</Label>
        <Input
          id="cliente-ciudad"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          placeholder="Valencia"
          autoComplete="address-level2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-whatsapp">WhatsApp de contacto</Label>
        <Input
          id="cliente-whatsapp"
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+34 600 000 000"
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cliente-gestoria">Su gestoría</Label>
        <Select value={gestoriaId} onValueChange={setGestoriaId}>
          <SelectTrigger id="cliente-gestoria" className="w-full">
            <SelectValue placeholder="Seleccione su gestoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sin">Sin gestoría (alta directa)</SelectItem>
            {gestorias.map((gestoria) => (
              <SelectItem key={gestoria.id} value={String(gestoria.id)}>
                {gestoria.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={cargando} className="mt-1">
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Creando cuenta…
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onVolverAPerfil}
        className="mx-auto text-muted-foreground"
      >
        <ArrowLeft aria-hidden="true" />
        Cambiar de tipo de cuenta
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Vista de autenticación                                             */
/* ------------------------------------------------------------------ */

export function AuthView({
  onSuccess,
  onVolver,
  modoInicial = "entrar",
}: {
  onSuccess: () => void;
  onVolver: () => void;
  modoInicial?: "entrar" | "registro";
}) {
  const [tab, setTab] = useState<"entrar" | "registro">(modoInicial);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [rol, setRol] = useState<Rol | null>(null);
  const [comun, setComun] = useState<DatosComunes>({ nombre: "", email: "", password: "" });

  function cambiarComun(cambios: Partial<DatosComunes>) {
    setComun((datos) => ({ ...datos, ...cambios }));
  }

  function cambiarTab(valor: string) {
    setTab(valor === "registro" ? "registro" : "entrar");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onVolver}
          className="-ml-2 self-start text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" />
          Volver
        </Button>

        <div className="my-auto flex flex-col">
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <Landmark className="size-5" />
            </span>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight">
                TicketFiscal <span className="text-emerald-700">AI</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Acceso para gestorías y empresas</p>
            </div>
          </div>

          <Card className="mt-8 py-8">
            <CardContent className="px-6">
              <Tabs value={tab} onValueChange={cambiarTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="entrar">Entrar</TabsTrigger>
                  <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="entrar" className="mt-6">
                  <FormularioLogin onSuccess={onSuccess} />
                </TabsContent>

                <TabsContent value="registro" className="mt-6">
                  {paso === 1 || rol === null ? (
                    <SeleccionPerfil rol={rol} onElegir={setRol} onContinuar={() => setPaso(2)} />
                  ) : rol === "GESTOR" ? (
                    <FormularioGestor
                      comun={comun}
                      onCambioComun={cambiarComun}
                      onSuccess={onSuccess}
                      onVolverAPerfil={() => setPaso(1)}
                    />
                  ) : (
                    <FormularioCliente
                      comun={comun}
                      onCambioComun={cambiarComun}
                      onSuccess={onSuccess}
                      onVolverAPerfil={() => setPaso(1)}
                    />
                  )}
                </TabsContent>
              </Tabs>

              <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
                Al continuar acepta el tratamiento de sus datos conforme al RGPD.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
