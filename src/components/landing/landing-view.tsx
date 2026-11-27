"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  EyeOff,
  FileCheck2,
  FileDown,
  Landmark,
  Lock,
  Menu,
  Server,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type EnlaceSeccion = { etiqueta: string; href: string };

const ENLACES: EnlaceSeccion[] = [
  { etiqueta: "Producto", href: "#producto" },
  { etiqueta: "Cómo funciona", href: "#como-funciona" },
  { etiqueta: "Innovación", href: "#innovacion" },
  { etiqueta: "Seguridad", href: "#seguridad" },
];

const SELLOS: { icono: LucideIcon; texto: string }[] = [
  { icono: Server, texto: "Base de datos en Frankfurt (UE)" },
  { icono: ShieldCheck, texto: "Validación según RD 1619/2012" },
  { icono: Landmark, texto: "Cruce con el extracto bancario" },
  { icono: Lock, texto: "Auditoría de cada cambio" },
];

const PASOS = [
  {
    numero: "01",
    titulo: "El cliente envía la foto",
    descripcion: "Por WhatsApp o desde el portal. Sin instalar nada y sin cambiar sus hábitos.",
  },
  {
    numero: "02",
    titulo: "La IA lee, las reglas deciden",
    descripcion:
      "La IA extrae los datos; un motor determinista verifica NIF/CIF, desglose de IVA, retenciones y fechas. La IA nunca da por válido un justificante.",
  },
  {
    numero: "03",
    titulo: "Se cruza con el banco",
    descripcion:
      "Cada cargo del extracto se empareja con su justificante. Lo que falta se reclama al cliente; lo que cuadra, a contabilidad.",
  },
  {
    numero: "04",
    titulo: "La gestoría revisa y exporta",
    descripcion: "Solo revisa las excepciones. Lote contable por empresa y trimestre, listo para a3, Sage o Holded.",
  },
];

const INNOVACION: { titulo: string; descripcion: string }[] = [
  {
    titulo: "IA que lee, reglas que deciden",
    descripcion:
      "Los modelos de visión son buenos leyendo y malos garantizando. Por eso la validez fiscal la decide un motor determinista y auditable, no el modelo: cada aviso indica la regla que lo causó.",
  },
  {
    titulo: "Del justificante al movimiento bancario",
    descripcion:
      "El cruce del extracto con los justificantes detecta gastos sin factura antes del cierre trimestral. Cada coincidencia propuesta explica sus motivos y la confirma una persona.",
  },
  {
    titulo: "Menos persecución, más criterio",
    descripcion:
      "El trabajo repetitivo de teclear y perseguir tickets pasa a la máquina. El criterio profesional se queda en la gestoría, con trazabilidad completa de quién cambió qué y cuándo.",
  },
];

const CARACTERISTICAS: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  insignia?: string;
}[] = [
  {
    icono: BadgeCheck,
    titulo: "Validación NIF/CIF",
    descripcion:
      "Dígito de control verificado en el servidor y consulta opcional al censo VIES para completar razón social y domicilio.",
  },
  {
    icono: Calculator,
    titulo: "Control matemático del IVA",
    descripcion:
      "Varios tipos en un mismo justificante (4, 10 y 21 %), base + cuota − retención = total y tolerancia de céntimos. Cualquier descuadre queda marcado.",
  },
  {
    icono: Landmark,
    titulo: "Conciliación con el extracto",
    descripcion:
      "Suba el extracto del banco (CSV, Excel o Norma 43) y el sistema propone qué cargo corresponde a qué justificante, explicando el porqué. Los cargos sin justificante se reclaman al cliente por WhatsApp.",
  },
  {
    icono: Building2,
    titulo: "Multi-empresa",
    descripcion:
      "Cada gestoría gestiona todas sus empresas desde un panel, con su número de WhatsApp autorizado y su bandeja de revisión.",
  },
  {
    icono: FileDown,
    titulo: "Exportación a3 · Sage · Holded",
    descripcion:
      "CSV contable español: separador «;», decimales con coma y BOM UTF-8. Importación directa en su software actual.",
  },
  {
    icono: FileCheck2,
    titulo: "Trazabilidad",
    descripcion:
      "Registro de auditoría, borrado lógico y detección de duplicados por huella digital: un registro fiscal no se destruye ni se cuenta dos veces.",
  },
];

const SEGURIDAD: { icono: LucideIcon; titulo: string; descripcion: string }[] = [
  {
    icono: Server,
    titulo: "Datos en la UE",
    descripcion:
      "Aplicación y base de datos en Frankfurt (Alemania). Las imágenes se envían para su lectura a un proveedor de IA; indicamos cuál en el contrato de encargo.",
  },
  {
    icono: EyeOff,
    titulo: "No guardamos la imagen",
    descripcion:
      "Conservamos los datos fiscales extraídos y la huella SHA-256 del original para detectar duplicados. La foto no se almacena.",
  },
  {
    icono: ShieldCheck,
    titulo: "Control de acceso",
    descripcion:
      "Sesiones revocables, contraseñas con scrypt, límites de uso, aislamiento entre gestorías y doble factor obligatorio para el administrador.",
  },
];

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        aria-hidden="true"
      >
        <Landmark className="size-5" />
      </span>
      <span className="font-serif text-lg font-bold tracking-tight">
        TicketFiscal <span className="text-emerald-700">AI</span>
      </span>
    </span>
  );
}

function SelloConfianza({ icono: Icono, texto }: { icono: LucideIcon; texto: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <Icono className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-xs font-medium text-muted-foreground sm:text-sm">{texto}</span>
    </div>
  );
}

function Paso({ numero, titulo, descripcion }: { numero: string; titulo: string; descripcion: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-1 flex-col gap-3 px-6">
        <span className="font-serif text-3xl font-semibold leading-none text-emerald-700">{numero}</span>
        <h3 className="font-semibold leading-snug">{titulo}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{descripcion}</p>
      </CardContent>
    </Card>
  );
}

function Caracteristica({
  icono: Icono,
  titulo,
  descripcion,
  insignia,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  insignia?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className="flex size-10 items-center justify-center rounded-lg border bg-secondary/50 text-primary"
        aria-hidden="true"
      >
        <Icono className="size-5" />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {insignia ? (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-800"
          >
            {insignia}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{descripcion}</p>
    </div>
  );
}

function BloqueSeguridad({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="border-t pt-6">
      <Icono className="size-5 text-primary" aria-hidden="true" />
      <h3 className="mt-4 font-semibold">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descripcion}</p>
    </div>
  );
}

export function LandingView({
  onEntrar,
  onRegistro,
}: {
  onEntrar: () => void;
  onRegistro: () => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Barra superior */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Marca />

          <nav aria-label="Secciones" className="hidden items-center gap-7 md:flex">
            {ENLACES.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {enlace.etiqueta}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={onEntrar}>
              Entrar
            </Button>
            <Button size="sm" onClick={onRegistro}>
              Solicitar acceso
            </Button>
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            <Button variant="outline" size="sm" onClick={onEntrar}>
              Entrar
            </Button>
            <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menú de navegación">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-serif text-lg font-bold tracking-tight">
                    TicketFiscal <span className="text-emerald-700">AI</span>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navegación por las secciones de la página
                  </SheetDescription>
                </SheetHeader>
                <nav aria-label="Secciones" className="flex flex-col gap-1 px-4">
                  {ENLACES.map((enlace) => (
                    <a
                      key={enlace.href}
                      href={enlace.href}
                      onClick={() => setMenuAbierto(false)}
                      className="rounded-md px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {enlace.etiqueta}
                    </a>
                  ))}
                </nav>
                <SheetFooter className="border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMenuAbierto(false);
                      onRegistro();
                    }}
                  >
                    Solicitar acceso
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-20" aria-labelledby="titulo-hero">
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/20 bg-secondary/60 px-3 py-1 text-xs font-medium"
            >
              <ShieldCheck className="size-3.5 text-emerald-700" aria-hidden="true" />
              Fiscalidad asistida por IA · para gestorías españolas
            </Badge>

            <h1
              id="titulo-hero"
              className="mt-6 text-balance font-serif text-4xl font-bold leading-tight tracking-tight md:text-5xl"
            >
              Del ticket de WhatsApp al asiento contable, verificado y conciliado con el banco.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              La IA lee los justificantes de sus clientes; un motor de reglas basado en la normativa
              de la AEAT decide si son válidos; y el cruce con el extracto bancario le dice qué
              gasto sigue sin factura. Usted solo revisa las excepciones.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={onRegistro} className="w-full sm:w-auto">
                Solicitar acceso
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button size="lg" variant="outline" onClick={onEntrar} className="w-full sm:w-auto">
                Ya tengo cuenta
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Alta de gestorías sujeta a aprobación · sin permanencia
            </p>
          </div>
        </section>

        {/* Barra de confianza */}
        <section aria-label="Cumplimiento normativo" className="border-y bg-secondary/50">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-4 gap-y-4 px-4 py-6 sm:px-6 md:grid-cols-4">
            {SELLOS.map((sello) => (
              <SelloConfianza key={sello.texto} icono={sello.icono} texto={sello.texto} />
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="scroll-mt-20 py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2
              id="titulo-como-funciona"
              className="max-w-2xl font-serif text-2xl font-semibold tracking-tight md:text-3xl"
            >
              De la foto al asiento, en cuatro pasos
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map((paso) => (
                <Paso key={paso.numero} {...paso} />
              ))}
            </div>
          </div>
        </section>

        {/* Innovación */}
        <section id="innovacion" aria-labelledby="titulo-innovacion" className="scroll-mt-20 border-y bg-secondary/40 py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2
              id="titulo-innovacion"
              className="max-w-3xl font-serif text-2xl font-semibold tracking-tight md:text-3xl"
            >
              Una forma distinta de usar la IA en fiscalidad
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              No sustituimos el criterio de la gestoría: le quitamos el trabajo que no aporta criterio.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {INNOVACION.map((i) => (
                <div key={i.titulo} className="border-t-2 border-primary pt-5">
                  <h3 className="font-serif text-lg font-semibold leading-snug">{i.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{i.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Producto */}
        <section
          id="producto"
          aria-labelledby="titulo-producto"
          className="scroll-mt-20 border-y bg-card py-14"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2
              id="titulo-producto"
              className="max-w-2xl font-serif text-2xl font-semibold tracking-tight md:text-3xl"
            >
              Se integra con el software que ya usa
            </h2>
            <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {CARACTERISTICAS.map((caracteristica) => (
                <Caracteristica key={caracteristica.titulo} {...caracteristica} />
              ))}
            </div>
          </div>
        </section>

        {/* Seguridad */}
        <section id="seguridad" aria-labelledby="titulo-seguridad" className="scroll-mt-20 py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2
              id="titulo-seguridad"
              className="max-w-2xl font-serif text-2xl font-semibold tracking-tight md:text-3xl"
            >
              Datos fiscales: qué hacemos y qué no
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {SEGURIDAD.map((bloque) => (
                <BloqueSeguridad key={bloque.titulo} {...bloque} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section aria-labelledby="titulo-cta" className="py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="rounded-xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-sm sm:px-12 md:py-16">
              <h2
                id="titulo-cta"
                className="mx-auto max-w-2xl text-balance font-serif text-2xl font-semibold tracking-tight md:text-3xl"
              >
                Pruébelo con sus diez clientes más difíciles
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-primary-foreground/80">
                Los que mandan fotos borrosas a las 23:00 de un domingo.
              </p>
              <Button size="lg" variant="secondary" onClick={onRegistro} className="mt-8">
                Solicitar acceso
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Pie */}
      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-serif text-base font-bold tracking-tight">TicketFiscal AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Captura, validación y conciliación fiscal para gestorías españolas.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Herramienta de apoyo: la gestoría sigue siendo responsable de las declaraciones presentadas.
          </p>
        </div>
      </footer>
    </div>
  );
}
