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
  KeyRound,
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
  { etiqueta: "Seguridad", href: "#seguridad" },
];

const SELLOS: { icono: LucideIcon; texto: string }[] = [
  { icono: Lock, texto: "RGPD · Datos en la UE" },
  { icono: ShieldCheck, texto: "RD 1619/2012" },
  { icono: FileCheck2, texto: "Modelo 303" },
  { icono: Server, texto: "Hosting Frankfurt" },
];

const PASOS = [
  {
    numero: "01",
    titulo: "El cliente reenvía el ticket",
    descripcion: "Una foto por WhatsApp. Sin apps, sin formularios, sin cambiar sus hábitos.",
  },
  {
    numero: "02",
    titulo: "La IA extrae y valida",
    descripcion:
      "NIF/CIF con dígito de control verificado, desglose de IVA 21/10/4%, cuadre matemático y cuenta del PGC.",
  },
  {
    numero: "03",
    titulo: "La gestoría exporta",
    descripcion:
      "Lote contable por empresa y trimestre, liquidación del Modelo 303 y CSV listo para a3, Sage o Holded.",
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
      "Dígito de control verificado en el servidor y consulta al censo VIES con autocompletado de razón social y domicilio.",
  },
  {
    icono: Calculator,
    titulo: "Control matemático del IVA",
    descripcion:
      "Base + cuota − retención = total, con tolerancia de 0,02 €. Cualquier descuadre queda marcado para revisión.",
  },
  {
    icono: Building2,
    titulo: "Multi-empresa",
    descripcion:
      "Cada gestoría gestiona todas sus empresas desde un panel, con su número de WhatsApp autorizado.",
  },
  {
    icono: FileDown,
    titulo: "Exportación a3 · Sage · Holded",
    descripcion:
      "CSV contable español: separador «;», decimales con coma y BOM UTF-8. Importación directa.",
  },
  {
    icono: Landmark,
    titulo: "Conciliación bancaria",
    descripcion:
      "GoCardless Bank Account Data: cruce del extracto real con los justificantes recibidos.",
    insignia: "Próximamente",
  },
  {
    icono: FileCheck2,
    titulo: "VeriFactu 2027",
    descripcion:
      "Preparados para el reglamento de facturación certificada con las reglas AEAT ya aplicadas hoy.",
    insignia: "En preparación",
  },
];

const SEGURIDAD: { icono: LucideIcon; titulo: string; descripcion: string }[] = [
  {
    icono: ShieldCheck,
    titulo: "Encargado del Tratamiento",
    descripcion: "Contrato de encargo conforme al RGPD con cada gestoría.",
  },
  {
    icono: Server,
    titulo: "Alojamiento en la UE",
    descripcion: "Servidores en Frankfurt (Alemania). Los datos no salen de Europa.",
  },
  {
    icono: EyeOff,
    titulo: "Minimización de datos",
    descripcion: "Solo procesamos lo que exige la norma: NIF, importes y tipo de IVA.",
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
            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
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
              Para gestorías y asesorías fiscales en España
            </Badge>

            <h1
              id="titulo-hero"
              className="mt-6 text-balance font-serif text-4xl font-bold leading-tight tracking-tight md:text-5xl"
            >
              Los justificantes de sus clientes, ya son asientos contables.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              TicketFiscal AI recibe los tickets y facturas de sus clientes por WhatsApp, extrae los
              datos fiscales con IA, valida el NIF/CIF y el cuadre del IVA según la AEAT, y le
              entrega el lote contable listo para importar en a3, Sage o Holded.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={onEntrar} className="w-full sm:w-auto">
                Ver la demo
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button size="lg" variant="outline" onClick={onRegistro} className="w-full sm:w-auto">
                Registrar mi gestoría
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Demo completa con datos de ejemplo · sin registro previo
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
              De WhatsApp al ERP, en tres pasos
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PASOS.map((paso) => (
                <Paso key={paso.numero} {...paso} />
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
              Una capa fiscal completa sobre su software actual
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
              Sus datos fiscales, tratados como corresponde
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
                Empiece por sus diez clientes más difíciles
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-primary-foreground/80">
                Los que mandan fotos borrosas a las 23:00 de un domingo.
              </p>
              <Button size="lg" variant="secondary" onClick={onEntrar} className="mt-8">
                Entrar en la demo
              </Button>

              <div className="mx-auto mt-10 flex max-w-lg items-start gap-3 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-3 text-left">
                <KeyRound
                  className="mt-0.5 size-3.5 shrink-0 text-primary-foreground/70"
                  aria-hidden="true"
                />
                <div className="text-xs leading-relaxed text-primary-foreground/85">
                  <p className="font-semibold text-primary-foreground">Cuentas de demostración</p>
                  <p className="mt-1">Gestoría: ana@gestoriaalboraya.es · Contraseña: demo1234</p>
                  <p>Cliente: juan@tallerperez.es · Contraseña: demo1234</p>
                </div>
              </div>
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
            Datos de demostración. No constituye asesoramiento fiscal.
          </p>
        </div>
      </footer>
    </div>
  );
}
