"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark,
  LogOut,
  MessageSquareText,
  FileStack,
  Loader2,
  RefreshCw,
  BadgeCheck,
  TriangleAlert,
  Calculator,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppChat } from "@/components/fiscal/whatsapp-chat";
import { etiquetaCuenta } from "@/lib/fiscal";
import type { Documento, UsuarioSesion } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClientePortal({
  usuario,
  onLogout,
}: {
  usuario: UsuarioSesion;
  onLogout: () => void;
}) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refresco, setRefresco] = useState(0);

  const empresa = usuario.empresa;

  // Carga por promesas: el estado se actualiza solo dentro de .then/.finally (fuera del efecto síncrono).
  const cargar = useCallback(
    () =>
      fetch("/api/documents", { cache: "no-store" })
        .then(async (res) => {
          if (res.status === 401) {
            onLogout();
            return;
          }
          const json = await res.json();
          setDocs(json.documentos ?? []);
        })
        .catch(() => {
          toast({ title: "Error", description: "No se pudieron cargar sus justificantes", variant: "destructive" });
        })
        .finally(() => setCargando(false)),
    [onLogout, toast]
  );

  useEffect(() => {
    void cargar();
  }, [cargar, refresco]);

  const resumen = useMemo(() => {
    const validos = docs.filter((d) => d.estado === "VALIDO").length;
    const pendientes = docs.filter(
      (d) => d.estado === "REQUIERE_REVISION" || d.estado === "ILEGIBLE"
    ).length;
    const ivaDeducible = docs
      .filter((d) => d.ivaDeducible)
      .reduce((s, d) => s + d.cuotaIva, 0);
    return { validos, pendientes, ivaDeducible };
  }, [docs]);

  if (!empresa) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Su cuenta no tiene empresa asociada. Contacte con su gestoría.
      </div>
    );
  }

  const nombrePropio = usuario.nombre.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Cabecera */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold leading-tight tracking-tight">
                TicketFiscal <span className="text-emerald-700">AI</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {empresa.nombre} · NIF {empresa.nif}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {usuario.nombre}
            </span>
            <Button variant="outline" size="sm" className="h-9" onClick={onLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Buenas, {nombrePropio}. Sus justificantes, al día.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reenvíe la foto del ticket o factura tal como la reciba. {usuario.gestoria ? `Su gestoría (${usuario.gestoria.nombre}) ` : "Su gestoría "}la recibe clasificada y validada en segundos.
          </p>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-secondary p-2.5">
                <FileStack className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{docs.length}</p>
                <p className="text-xs text-muted-foreground">Justificantes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-emerald-100 p-2.5">
                <BadgeCheck className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{resumen.validos}</p>
                <p className="text-xs text-muted-foreground">Registrados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-100 p-2.5">
                <TriangleAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{resumen.pendientes}</p>
                <p className="text-xs text-muted-foreground">Con avisos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="enviar" className="w-full">
          <TabsList className="mb-4 h-auto w-full flex-wrap gap-1 rounded-xl p-1 sm:h-11 sm:w-fit">
            <TabsTrigger value="enviar" className="flex-1 gap-2 rounded-lg px-4 text-sm sm:flex-none">
              <MessageSquareText className="h-4 w-4" />
              Enviar justificante
            </TabsTrigger>
            <TabsTrigger value="mistickets" className="flex-1 gap-2 rounded-lg px-4 text-sm sm:flex-none">
              <FileStack className="h-4 w-4" />
              Mis justificantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="mt-0">
            <div className="mx-auto mb-4 max-w-2xl text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Así se ve su WhatsApp: reenvíe la foto y el asistente fiscal de su gestoría la lee,
                valida y contabiliza. Guarden el número en su agenda con el nombre de la gestoría.
              </p>
            </div>
            <WhatsAppChat
              cliente={{
                nombre: usuario.nombre,
                nif: empresa.nif,
                empresaNombre: empresa.nombre,
                gestoriaNombre: usuario.gestoria?.nombre ?? "su gestoría",
              }}
              onDocumentoProcesado={() => setRefresco((n) => n + 1)}
            />
          </TabsContent>

          <TabsContent value="mistickets" className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileStack className="h-4 w-4 text-primary" />
                  Historial de justificantes
                </CardTitle>
                <Button variant="outline" size="sm" className="h-9" onClick={() => {
                  setCargando(true);
                  void cargar();
                }}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar
                </Button>
              </CardHeader>
              <CardContent>
                {cargando ? (
                  <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
                  </div>
                ) : docs.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">
                    Todavía no hay justificantes. En cuanto reenvíe su primer ticket por WhatsApp,
                    aparecerá aquí en segundos.
                  </div>
                ) : (
                  <div className="max-h-[26rem] overflow-auto rounded-md border">
                    <Table className="min-w-[680px]">
                      <TableHeader className="sticky top-0 z-10 bg-muted">
                        <TableRow>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Nº / Emisor</TableHead>
                          <TableHead className="text-xs">Concepto (PGC)</TableHead>
                          <TableHead className="text-right text-xs">Base</TableHead>
                          <TableHead className="text-right text-xs">IVA</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                          <TableHead className="text-center text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docs.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {d.fechaEmision ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[190px]">
                              <p className="truncate text-xs font-medium">{d.numeroFactura ?? "—"}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {d.emisorNombre ?? "Sin leer"}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-[160px]">
                              <p className="truncate text-xs">{etiquetaCuenta(d.cuentaPgc)}</p>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {d.baseImponible.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {d.cuotaIva.toFixed(2)}
                              <span className="text-[10px] text-muted-foreground"> ({d.porcentajeIva}%)</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums">
                              {d.totalFactura.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  d.estado === "VALIDO"
                                    ? "bg-emerald-700"
                                    : d.estado === "REQUIERE_REVISION"
                                      ? "bg-amber-600"
                                      : "bg-red-700"
                                )}
                              >
                                {d.estado === "VALIDO"
                                  ? "Registrado"
                                  : d.estado === "REQUIERE_REVISION"
                                    ? "A revisar"
                                    : "Ilegible"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t bg-white/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-xs text-muted-foreground">
            {resumen.ivaDeducible.toFixed(2)} € de IVA soportado deducible registrados este
            ejercicio. Datos de demostración.
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calculator className="h-3.5 w-3.5 text-emerald-700" />
            Autoliquidación Modelo 303 preparada por su gestoría
          </p>
        </div>
      </footer>
    </div>
  );
}
