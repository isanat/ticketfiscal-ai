"use client";

import { useState } from "react";
import { MessageSquareText, Building2, Zap, ShieldCheck, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WhatsAppChat } from "@/components/fiscal/whatsapp-chat";
import { GestoriaPanel } from "@/components/fiscal/gestoria-panel";

export default function Home() {
  const [refresco, setRefresco] = useState(0);
  const [tab, setTab] = useState("whatsapp");

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
              <Sparkles className="h-3 w-3 text-primary" /> Modelo 303 · PGC
            </Badge>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 px-4 py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="mb-5 flex justify-center">
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
      </main>

      {/* Pie de página fijo */}
      <footer className="mt-auto border-t bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">TicketFiscal AI</span> · Demo piloto
            para gestorías — integrable con a3, Sage, Holded y WhatsApp Business API.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Hecho con reglas fiscales españolas · IVA 21/10/4% · PGC 600–629
          </p>
        </div>
      </footer>
    </div>
  );
}
