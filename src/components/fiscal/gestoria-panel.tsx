"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Eye,
  Inbox,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { etiquetaCuenta } from "@/lib/fiscal";
import type { Documento } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  refresco: number;
}

export function GestoriaPanel({ refresco }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trimestre, setTrimestre] = useState<string>("todos");
  const [detalle, setDetalle] = useState<Documento | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const json = await res.json();
      setDocs(json.documentos ?? []);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el panel", variant: "destructive" });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [refresco]);

  const trimestres = useMemo(() => {
    const s = new Set<string>();
    docs.forEach((d) => d.trimestre && s.add(d.trimestre));
    return Array.from(s).sort();
  }, [docs]);

  const filtrados = useMemo(
    () => (trimestre === "todos" ? docs : docs.filter((d) => d.trimestre === trimestre)),
    [docs, trimestre]
  );

  const resumen = useMemo(() => {
    const validos = filtrados.filter((d) => d.estado === "VALIDO").length;
    const revision = filtrados.filter((d) => d.estado === "REQUIERE_REVISION").length;
    const base = filtrados.reduce((s, d) => s + d.baseImponible, 0);
    const ivaDeducible = filtrados
      .filter((d) => d.ivaDeducible)
      .reduce((s, d) => s + d.cuotaIva, 0);
    const total = filtrados.reduce((s, d) => s + d.totalFactura, 0);

    const porTipo: Record<string, { base: number; cuota: number }> = {};
    filtrados
      .filter((d) => d.ivaDeducible)
      .forEach((d) => {
        const k = String(d.porcentajeIva);
        porTipo[k] = porTipo[k] ?? { base: 0, cuota: 0 };
        porTipo[k].base += d.baseImponible;
        porTipo[k].cuota += d.cuotaIva;
      });

    return { validos, revision, base, ivaDeducible, total, porTipo };
  }, [filtrados]);

  async function eliminar(id: string) {
    setEliminando(id);
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((d) => d.filter((x) => x.id !== id));
      toast({ title: "Documento eliminado del lote" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
      setEliminando(null);
    }
  }

  function exportarCsv() {
    const q = trimestre !== "todos" ? `?trimestre=${encodeURIComponent(trimestre)}` : "";
    window.open(`/api/documents/export${q}`, "_blank");
    toast({
      title: "Exportación generada",
      description: "Archivo CSV listo para importar en a3, Sage o Holded.",
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{filtrados.length}</p>
              <p className="text-xs text-muted-foreground">Documentos en el lote</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{resumen.validos}</p>
              <p className="text-xs text-muted-foreground">Válidos y listos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <TriangleAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{resumen.revision}</p>
              <p className="text-xs text-muted-foreground">Requieren revisión</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {resumen.ivaDeducible.toFixed(2)} €
              </p>
              <p className="text-xs text-muted-foreground">IVA deducible (Modelo 303)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Tabla de documentos */}
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Lote contable · {CLIENTE}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={trimestre} onValueChange={setTrimestre}>
                <SelectTrigger className="h-9 w-[170px] text-xs">
                  <SelectValue placeholder="Trimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los trimestres</SelectItem>
                  {trimestres.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} (Modelo 303)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={() => void cargar()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar
              </Button>
              <Button
                size="sm"
                className="h-9"
                onClick={exportarCsv}
                disabled={filtrados.length === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cargando ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando documentos…
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Todavía no hay justificantes en el lote.
                <br />
                Envía un ticket desde la pestaña «WhatsApp del cliente» y aparecerá aquí al instante.
              </div>
            ) : (
              <div className="max-h-[26rem] overflow-auto rounded-md border">
                <Table className="min-w-[640px]">
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Nº / Emisor</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">PGC</TableHead>
                      <TableHead className="text-right text-xs">Base</TableHead>
                      <TableHead className="text-right text-xs">IVA</TableHead>
                      <TableHead className="text-right text-xs">Total</TableHead>
                      <TableHead className="text-center text-xs">Estado</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((d) => (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => setDetalle(d)}>
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">
                          {d.fechaEmision ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[170px]">
                          <p className="truncate text-xs font-medium">{d.numeroFactura ?? "—"}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {d.emisorNombre ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              d.tipoDocumento === "FACTURA_COMPLETA"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : d.tipoDocumento === "FACTURA_SIMPLIFICADA"
                                  ? "border-gray-300 bg-gray-50 text-gray-600"
                                  : "border-red-300 bg-red-50 text-red-700"
                            )}
                          >
                            {d.tipoDocumento === "FACTURA_COMPLETA"
                              ? "Completa"
                              : d.tipoDocumento === "FACTURA_SIMPLIFICADA"
                                ? "Simplificada"
                                : "No válida"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{d.cuentaPgc ?? "—"}</TableCell>
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
                                ? "bg-emerald-600"
                                : d.estado === "REQUIERE_REVISION"
                                  ? "bg-amber-500"
                                  : "bg-red-600"
                            )}
                          >
                            {d.estado === "VALIDO"
                              ? "Válido"
                              : d.estado === "REQUIERE_REVISION"
                                ? "Revisar"
                                : "Ilegible"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetalle(d);
                              }}
                              aria-label="Ver detalle"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              disabled={eliminando === d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void eliminar(d.id);
                              }}
                              aria-label="Eliminar documento"
                            >
                              {eliminando === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen Modelo 303 */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Liquidación IVA · Modelo 303
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {trimestre === "todos" ? "Acumulado de todos los trimestres" : `Trimestre ${trimestre}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[21, 10, 4, 0].map((pct) => {
              const linea = resumen.porTipo[String(pct)];
              if (!linea) return null;
              return (
                <div key={pct} className="rounded-lg border p-3">
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    IVA {pct === 0 ? "exento" : `${pct}%`}
                  </p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Base: </span>
                    <span className="text-sm font-medium tabular-nums">
                      {linea.base.toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Cuota: </span>
                    <span className="text-base font-bold tabular-nums text-primary">
                      {linea.cuota.toFixed(2)} €
                    </span>
                  </div>
                </div>
              );
            })}
            {Object.keys(resumen.porTipo).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aún no hay IVA deducible registrado en este periodo. Las facturas simplificadas sin
                NIF del destinatario no son deducibles (art. 97 LIVA).
              </p>
            )}
            <div className="rounded-lg border-2 border-primary/30 bg-secondary/60 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Total IVA deducible</span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {resumen.ivaDeducible.toFixed(2)} €
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Solo se computan facturas completas o simplificadas cualificadas con derecho a
                deducción.
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Los totales se calculan sobre las bases y cuotas extraídas automáticamente. Antes de
              presentar el Modelo 303, revisa las facturas marcadas «Revisar».
            </p>
          </CardContent>
        </Card>
      </div>

      <DialogoDetalle doc={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}

const CLIENTE = "Juan Pérez García";

function DialogoDetalle({ doc, onClose }: { doc: Documento | null; onClose: () => void }) {
  if (!doc) return null;
  const filas: Array<[string, string]> = [
    ["Estado", doc.estado],
    ["Tipo de documento", doc.tipoDocumento],
    ["IVA deducible", doc.ivaDeducible ? "Sí" : "No"],
    ["Emisor", `${doc.emisorNombre ?? "—"} (${doc.emisorNif ?? "sin NIF"})`],
    ["Receptor", `${doc.receptorNombre ?? "—"} (${doc.receptorNif ?? "sin NIF"})`],
    ["Nº factura", doc.numeroFactura ?? "—"],
    ["Fecha emisión", doc.fechaEmision ?? "—"],
    ["Cuenta PGC", etiquetaCuenta(doc.cuentaPgc)],
    ["Base imponible", `${doc.baseImponible.toFixed(2)} €`],
    [`Cuota IVA (${doc.porcentajeIva}%)`, `${doc.cuotaIva.toFixed(2)} €`],
    ["Retención IRPF", doc.irpfImporte > 0 ? `${doc.irpfImporte.toFixed(2)} € (${doc.irpfPorcentaje}%)` : "—"],
    ["Total factura", `${doc.totalFactura.toFixed(2)} €`],
    ["Confianza de extracción", `${Math.round(doc.confianza * 100)}%`],
  ];

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Justificante · {doc.numeroFactura ?? "sin número"}
            <Badge
              className={
                doc.estado === "VALIDO"
                  ? "bg-emerald-600"
                  : doc.estado === "REQUIERE_REVISION"
                    ? "bg-amber-500"
                    : "bg-red-600"
              }
            >
              {doc.estado === "VALIDO" ? "Válido" : doc.estado === "REQUIERE_REVISION" ? "Revisar" : "Ilegible"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Enviado por {doc.clienteNombre} ({doc.clienteNif})
            {doc.trimestre ? ` · Trimestre ${doc.trimestre}` : ""}
          </DialogDescription>
        </DialogHeader>

        {doc.imagenNombre && (
          <p className="text-xs text-muted-foreground">Archivo: {doc.imagenNombre}</p>
        )}

        {doc.motivoRevision && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <TriangleAlert className="h-3.5 w-3.5" /> Motivo de revisión
            </p>
            {doc.motivoRevision}
          </div>
        )}

        <dl className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
          {filas.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed pb-1">
              <dt className="shrink-0 text-xs text-muted-foreground">{k}</dt>
              <dd className="text-right text-xs font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
