"use client";

// Conciliación bancaria: cruza el extracto del banco con los justificantes recibidos.
// El motor sugiere y explica cada coincidencia; la gestoría confirma. Nada se concilia solo.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Link2Off, Loader2, ReceiptText, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { eur, fechaEs } from "@/lib/format";
import type { EmpresaResumen } from "@/lib/types";

interface Mov {
  id: string;
  fecha: string;
  importe: number;
  descripcion: string;
}
interface Doc {
  id: string;
  fechaEmision: string | null;
  total: number;
  emisorNombre: string | null;
  numeroFactura: string | null;
}
interface Sugerencia {
  movimiento: Mov;
  documento: Doc;
  puntuacion: number;
  confianza: "ALTA" | "MEDIA";
  motivos: string[];
}
interface Confirmada {
  id: string;
  movimiento: Mov;
  documento: Doc;
  puntuacion: number;
  motivos: string[];
}
interface Vista {
  confirmados: Confirmada[];
  sugerencias: Sugerencia[];
  movimientosSinDocumento: Mov[];
  documentosSinMovimiento: Doc[];
  resumen: {
    cargos: number;
    conciliados: number;
    sugeridos: number;
    cargosSinJustificante: number;
    justificantes: number;
    justificantesSinCargo: number;
  };
}

const MAX_BYTES = 2_000_000;
const fecha = fechaEs;

/** Los extractos de banco (sobre todo Norma 43) suelen venir en ISO-8859-1. */
async function leerArchivo(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("iso-8859-1").decode(buf) : utf8;
}

function detectarFormato(nombre: string, contenido: string): "csv" | "n43" {
  if (/\.(n43|c43|txt)$/i.test(nombre) && /^11\d{18}/.test(contenido.trimStart())) return "n43";
  return /^11\d{18}/.test(contenido.trimStart()) ? "n43" : "csv";
}

function trimestresRecientes(): string[] {
  const hoy = new Date();
  let t = Math.floor(hoy.getMonth() / 3) + 1;
  let a = hoy.getFullYear();
  const r: string[] = [];
  for (let i = 0; i < 6; i++) {
    r.push(`${t}T${a}`);
    t -= 1;
    if (t === 0) {
      t = 4;
      a -= 1;
    }
  }
  return r;
}

export function ConciliacionView({
  empresas,
  empresaInicial,
  esCliente = false,
}: {
  empresas: EmpresaResumen[];
  empresaInicial?: string;
  /** El cliente solo ve su empresa: no hay selector. */
  esCliente?: boolean;
}) {
  const aprobadas = empresas.filter((e) => e.estado === "APROBADA");
  const [empresaId, setEmpresaId] = useState<string>(
    empresaInicial && aprobadas.some((e) => e.id === empresaInicial) ? empresaInicial : (aprobadas[0]?.id ?? "")
  );
  const [trimestre, setTrimestre] = useState("todos");
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [version, setVersion] = useState(0);
  const [importando, setImportando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!empresaId && !esCliente) return;
    let activo = true;
    const p = new URLSearchParams();
    if (empresaId) p.set("empresaId", empresaId);
    if (trimestre !== "todos") p.set("trimestre", trimestre);
    void Promise.resolve().then(() => activo && setCargando(true));
    fetch(`/api/conciliacion?${p}`, { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, js: await r.json().catch(() => ({})) }))
      .then(({ ok, js }) => {
        if (!activo) return;
        setError(ok ? null : (js.error ?? "No se pudo cargar la conciliación"));
        setVista(ok ? (js as Vista) : null);
        setCargando(false);
      })
      .catch(() => {
        if (!activo) return;
        setError("Error de conexión");
        setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empresaId, trimestre, version, esCliente]);

  async function importar(f: File) {
    if (f.size > MAX_BYTES) {
      toast({ title: "Archivo demasiado grande", description: "El máximo es 2 MB por extracto.", variant: "destructive" });
      return;
    }
    setImportando(true);
    try {
      const contenido = await leerArchivo(f);
      const res = await fetch("/api/conciliacion/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresaId || undefined, formato: detectarFormato(f.name, contenido), contenido }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "No se pudo importar", description: js.error ?? "Revise el formato del archivo.", variant: "destructive" });
        return;
      }
      toast({
        title: "Extracto importado",
        description: `${js.importados} movimientos nuevos${js.duplicados ? `, ${js.duplicados} ya existían` : ""}${js.ignoradas ? `, ${js.ignoradas} líneas ignoradas` : ""}.`,
      });
      refrescar();
    } finally {
      setImportando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function confirmar(m: Mov, d: Doc) {
    setOcupado(m.id);
    const res = await fetch("/api/conciliacion/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: empresaId || undefined, movimientoId: m.id, documentoId: d.id }),
    });
    const js = await res.json().catch(() => ({}));
    setOcupado(null);
    if (!res.ok) toast({ title: "No se pudo confirmar", description: js.error, variant: "destructive" });
    else refrescar();
  }

  async function deshacer(movimientoId: string) {
    setOcupado(movimientoId);
    const q = new URLSearchParams({ movimientoId });
    if (empresaId) q.set("empresaId", empresaId);
    const res = await fetch(`/api/conciliacion/confirmar?${q}`, { method: "DELETE" });
    setOcupado(null);
    if (!res.ok) toast({ title: "No se pudo deshacer", variant: "destructive" });
    else refrescar();
  }

  if (aprobadas.length === 0 && !esCliente) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aún no hay empresas aprobadas. Apruebe una empresa para conciliar su extracto bancario.
        </CardContent>
      </Card>
    );
  }

  const r = vista?.resumen;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <Wallet className="h-4 w-4 text-primary" /> Cruce del extracto con los justificantes
          </CardTitle>
          <CardDescription>
            Importe el extracto del banco (CSV o Norma 43). El sistema propone qué cargo corresponde a qué justificante y explica por qué; usted
            confirma. Reimportar el mismo extracto no duplica movimientos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {!esCliente && (
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-9 w-[220px] text-xs" aria-label="Empresa a conciliar">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {aprobadas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={trimestre} onValueChange={setTrimestre}>
            <SelectTrigger className="h-9 w-[190px] text-xs" aria-label="Trimestre">
              <SelectValue placeholder="Trimestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los trimestres</SelectItem>
              {trimestresRecientes().map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,.n43,.c43,text/csv,text/plain"
            className="sr-only"
            aria-label="Archivo de extracto"
            onChange={(e) => e.target.files?.[0] && void importar(e.target.files[0])}
          />
          <Button size="sm" className="h-9" disabled={importando} onClick={() => input.current?.click()}>
            {importando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
            Importar extracto
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando && !vista ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : (
        vista &&
        r && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi etiqueta="Cargos del banco" valor={r.cargos} />
              <Kpi etiqueta="Conciliados" valor={r.conciliados} tono="ok" />
              <Kpi etiqueta="Pendientes de confirmar" valor={r.sugeridos} tono={r.sugeridos > 0 ? "aviso" : undefined} />
              <Kpi etiqueta="Cargos sin justificante" valor={r.cargosSinJustificante} tono={r.cargosSinJustificante > 0 ? "aviso" : undefined} />
            </div>

            {r.cargos === 0 && (
              <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Aún no hay movimientos bancarios en este periodo. Importe un extracto para empezar.
              </p>
            )}

            {vista.sugerencias.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-base">Coincidencias propuestas</CardTitle>
                  <CardDescription>Revise los motivos y confirme. Las de confianza alta coinciden en importe y en fecha o emisor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vista.sugerencias.map((s) => (
                    <div key={s.movimiento.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cargo bancario</p>
                            <p className="truncate text-sm font-medium">{s.movimiento.descripcion}</p>
                            <p className="text-xs text-muted-foreground">
                              {fecha(s.movimiento.fecha)} · {eur(Math.abs(s.movimiento.importe))}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Justificante</p>
                            <p className="truncate text-sm font-medium">{s.documento.emisorNombre ?? "Emisor sin identificar"}</p>
                            <p className="text-xs text-muted-foreground">
                              {fecha(s.documento.fechaEmision)} · {eur(s.documento.total)}
                              {s.documento.numeroFactura ? ` · nº ${s.documento.numeroFactura}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={s.confianza === "ALTA" ? "default" : "secondary"}>
                            {s.confianza === "ALTA" ? "Confianza alta" : "Confianza media"} · {Math.round(s.puntuacion * 100)} %
                          </Badge>
                          <Button size="sm" disabled={ocupado === s.movimiento.id} onClick={() => void confirmar(s.movimiento, s.documento)}>
                            {ocupado === s.movimiento.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                            Confirmar
                          </Button>
                        </div>
                      </div>
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                        {s.motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-serif text-base">
                    <ReceiptText className="h-4 w-4 text-amber-600" /> Cargos sin justificante
                  </CardTitle>
                  <CardDescription>{esCliente ? "Pagos de su banco para los que falta la factura o el ticket: envíelos desde «Enviar justificante»." : "Pagos del banco para los que falta factura o ticket: es lo que hay que reclamar al cliente."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TablaMov filas={vista.movimientosSinDocumento} vacio="Todos los cargos tienen justificante." />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-serif text-base">
                    <Link2Off className="h-4 w-4 text-muted-foreground" /> Justificantes sin cargo
                  </CardTitle>
                  <CardDescription>Pagados en efectivo, con otra cuenta o aún no cargados en el extracto importado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Emisor</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vista.documentosSinMovimiento.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                              Todos los justificantes tienen cargo.
                            </TableCell>
                          </TableRow>
                        ) : (
                          vista.documentosSinMovimiento.map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="whitespace-nowrap text-xs">{fecha(d.fechaEmision)}</TableCell>
                              <TableCell className="max-w-[220px] truncate text-sm">{d.emisorNombre ?? "—"}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{eur(d.total)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {vista.confirmados.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-base">Conciliados</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Justificante</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vista.confirmados.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap text-xs">{fecha(c.movimiento.fecha)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{c.movimiento.descripcion}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{c.documento.emisorNombre ?? "—"}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{eur(c.documento.total)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" disabled={ocupado === c.movimiento.id} onClick={() => void deshacer(c.movimiento.id)}>
                              Deshacer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}

function Kpi({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: "ok" | "aviso" }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className={`font-serif text-2xl font-semibold tabular-nums ${tono === "ok" ? "text-emerald-700" : tono === "aviso" ? "text-amber-700" : ""}`}>{valor}</p>
      </CardContent>
    </Card>
  );
}

function TablaMov({ filas, vacio }: { filas: Mov[]; vacio: string }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                {vacio}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-xs">{fecha(m.fecha)}</TableCell>
                <TableCell className="max-w-[240px] truncate text-sm">{m.descripcion}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{eur(Math.abs(m.importe))}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
