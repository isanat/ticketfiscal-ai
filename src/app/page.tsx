"use client";

import { useState } from "react";
import {
  MessageSquareText,
  Building2,
  Zap,
  ShieldCheck,
  Sparkles,
  BadgeCheck,
  Landmark,
  Network,
  Lock,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WhatsAppChat } from "@/components/fiscal/whatsapp-chat";
import { GestoriaPanel } from "@/components/fiscal/gestoria-panel";

export default function Home() {
  const [refresco, setRefresco] = useState(0);
  const [tab, setTab] = useState("whatsapp");

  // Al cambiar de pestaña, subir al inicio para que la cabecera fija
  // no tape los contenidos cuando el usuario venía de una sección inferior.
  function cambiarTab(valor: string) {
    setTab(valor);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Cabecera */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                TicketFiscal <span className="text-primary">AI</span>
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Del ticket de WhatsApp al asiento contable · reglas AEAT y PGC
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="outline" className="gap-1 border-primary/40 bg-secondary text-[11px]">
              <ShieldCheck className="h-3 w-3 text-primary" /> Validación RD 1619/2012
            </Badge>
            <Badge variant="outline" className="gap-1 border-primary/40 bg-secondary text-[11px]">
              <BadgeCheck className="h-3 w-3 text-primary" /> NIF/CIF verificado
            </Badge>
            <Badge variant="outline" className="gap-1 border-primary/40 bg-secondary text-[11px]">
              <Sparkles className="h-3 w-3 text-primary" /> Modelo 303 · PGC
            </Badge>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 px-4 py-6">
        <Tabs value={tab} onValueChange={cambiarTab} className="w-full">
          {/* Barra de pestañas fija bajo la cabecera: nunca queda tapada
              al hacer scroll, siempre visible y clicable */}
          <div className="sticky top-16 z-30 -mx-4 mb-5 flex justify-center border-b bg-background/95 px-4 py-2 backdrop-blur">
            <TabsList className="h-auto w-full max-w-full flex-wrap gap-1 rounded-xl p-1 sm:h-11 sm:w-fit">
              <TabsTrigger
                value="whatsapp"
                className="flex-1 gap-2 rounded-lg px-4 text-sm data-[state=active]:shadow-sm sm:flex-none"
              >
                <MessageSquareText className="h-4 w-4" />
                WhatsApp del cliente
              </TabsTrigger>
              <TabsTrigger
                value="gestoria"
                className="flex-1 gap-2 rounded-lg px-4 text-sm data-[state=active]:shadow-sm sm:flex-none"
              >
                <Building2 className="h-4 w-4" />
                Panel de gestoría
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="whatsapp" className="mt-0">
            <div className="mx-auto mb-4 max-w-2xl text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Simula el flujo real del autónomo: reenvía un justificante al bot de la gestoría y
                la IA extrae NIF, base, IVA (21/10/4%), IRPF, detecta facturas simplificadas y
                clasifica la cuenta del PGC — con aviso al cliente al instante.
              </p>
            </div>
            <WhatsAppChat onDocumentoProcesado={() => setRefresco((n) => n + 1)} />
          </TabsContent>

          <TabsContent value="gestoria" className="mt-0">
            <div className="mx-auto mb-4 max-w-3xl text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Vista del asesor fiscal: lote contable del cliente con validación matemática
                automática, resumen de liquidación del Modelo 303 y exportación CSV lista para
                a3, Sage o Holded.
              </p>
            </div>
            <GestoriaPanel refresco={refresco} />
          </TabsContent>
        </Tabs>

        {/* Hoja de ruta del producto */}
        <section aria-labelledby="hoja-ruta" className="mx-auto mt-10 w-full max-w-6xl">
          <div className="mb-4 text-center">
            <h2 id="hoja-ruta" className="text-lg font-bold tracking-tight">
              Hoja de ruta del producto
            </h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
              Lo que ya funciona en esta demo y lo que llega para el piloto con gestorías.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <BadgeCheck className="h-5 w-5 text-emerald-600" />
                <Badge className="bg-emerald-600 text-[10px]">Ya activo</Badge>
              </div>
              <h3 className="text-sm font-semibold">Validación NIF/CIF determinística</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Dígito de control verificado en TypeScript antes de aprobar cada documento — sin
                depender solo de la IA. Próximo: censo VIES/AEAT.
              </p>
            </article>
            <article className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Network className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                  <Clock3 className="mr-1 h-3 w-3" /> Siguiente hito
                </Badge>
              </div>
              <h3 className="text-sm font-semibold">Multi-empresa · PostgreSQL</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Migración a Supabase/Neon: 1 gestoría → N empresas → N números de WhatsApp
                autorizados, con login para el asesor.
              </p>
            </article>
            <article className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Landmark className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                  <Clock3 className="mr-1 h-3 w-3" /> En camino
                </Badge>
              </div>
              <h3 className="text-sm font-semibold">Conciliación bancaria</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                GoCardless Bank Account Data: cruce del extractato real del banco español con los
                justificantes recibidos por WhatsApp.
              </p>
            </article>
            <article className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Lock className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                  <Clock3 className="mr-1 h-3 w-3" /> En camino
                </Badge>
              </div>
              <h3 className="text-sm font-semibold">RGPD · hosting en la UE</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Servidores en Frankfurt/París y contrato de Encargado del Tratamiento para
                procesar NIFs y datos bancarios reales.
              </p>
            </article>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Arquitectura ya preparada: la capa de datos está aislada para cambiar SQLite por
            PostgreSQL sin tocar la lógica fiscal.
          </p>
        </section>
      </main>

      {/* Pie de página fijo */}
      <footer className="mt-auto border-t bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">TicketFiscal AI</span> · Demo piloto
            para gestorías — integrable con a3, Sage, Holded y WhatsApp Business API. Datos
            ficticios de demostración.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Hecho con reglas fiscales españolas · IVA 21/10/4% · PGC 600–629
          </p>
        </div>
      </footer>
    </div>
  );
}
