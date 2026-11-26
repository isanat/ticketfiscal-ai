"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark,
  LogOut,
  LayoutDashboard,
  Building2,
  Inbox,
  FileDown,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  TriangleAlert,
  Calculator,
  CheckCircle2,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { etiquetaCuenta } from "@/lib/fiscal";
import type { Documento, EmpresaResumen, UsuarioSesion } from "@/lib/types";
import { cn } from "@/lib/utils";

type Vista = "resumen" | "empresas" | "bandeja" | "exportar";

export function GestorPortal({
  usuario,
  onLogout,
}: {
  usuario: UsuarioSesion;
  onLogout: () => void;
}) {
  const [vista, setVista] = useState<Vista>("resumen");
  const [docs, setDocs] = useState<Documento[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [trimestre, setTrimestre] = useState<string>("todos");
  const [detalle, setDetalle] = useState<Documento | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const gestoria = usuario.gestoria;

  // Carga por promesas: el estado se actualiza solo dentro de .then/.finally (fuera del efecto síncrono).
  const cargar = useCallback(
    () =>
      Promise.all([fetch("/api/documents", { cache: "no-store" }), fetch("/api/empresas", { cache: "no-store" })])
        .then(async ([resDocs, resEmp]) => {
          if (resDocs.status === 401 || resEmp.status === 401) {
            onLogout();
            return;
          }
          const jsonDocs = await resDocs.json();
          setDocs(jsonDocs.documentos ?? []);
          if (resEmp.ok) {
            const jsonEmp = await resEmp.json();
            setEmpresas(jsonEmp.empresas ?? []);
          }
        })
        .catch(() => {
          toast({ title: "Error", description: "No se pudo cargar el panel", variant: "destructive" });
        })
        .finally(() => setCargando(false)),
    [onLogout]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const trimestres = useMemo(() => {
    const s = new Set<string>();
    docs.forEach((d) => d.trimestre && s.add(d.trimestre));
    return Array.from(s).sort();
  }, [docs]);

  const nombresEmpresas = useMemo(
    () => new Map(empresas.map((e) => [e.id, e.nombre])),
    [empresas]
  );

  const filtrados = useMemo(
    () =>
      docs.filter(
        (d) =>
          (empresaFiltro === "todas" || d.empresaId === empresaFiltro) &&
          (trimestre === "todos" || d.trimestre === trimestre)
      ),
    [docs, empresaFiltro, trimestre]
  );

  const bandeja = useMemo(
    () =>
      docs.filter(
        (d) =>
          (d.estado === "REQUIERE_REVISION" || d.estado === "ILEGIBLE") &&
          (empresaFiltro === "todas" || d.empresaId === empresaFiltro)
      ),
    [docs, empresaFiltro]
  );

  const resumen = useMemo(() => {
    const validos = filtrados.filter((d) => d.estado === "VALIDO").length;
    const pendientes = filtrados.filter(
      (d) => d.estado === "REQUIERE_REVISION" || d.estado === "ILEGIBLE"
    ).length;
    const ivaDeducible = filtrados
      .filter((d) => d.ivaDeducible)
      .reduce((s, d) => s + d.cuotaIva, 0);
    const retenciones = filtrados.reduce((s, d) => s + d.irpfImporte, 0);

    const porTipo: Record<string, { base: number; cuota: number }> = {};
    filtrados
      .filter((d) => d.ivaDeducible)
      .forEach((d) => {
        const k = String(d.porcentajeIva);
        porTipo[k] = porTipo[k] ?? { base: 0, cuota: 0 };
        porTipo[k].base += d.baseImponible;
        porTipo[k].cuota += d.cuotaIva;
      });

    return { validos, pendientes, ivaDeducible, retenciones, porTipo };
  }, [filtrados]);

  async function revisarDocumento(id: string, revision: "APROBADO" | "RECHAZADO") {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setDocs((d) => d.map((x) => (x.id === id ? (json.documento as Documento) : x)));
      toast({ title: revision === "APROBADO" ? "Justificante aprobado" : "Justificante rechazado" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo guardar", variant: "destructive" });
    }
  }

  async function cambiarEstadoEmpresa(id: string, estado: "APROBADA" | "RECHAZADA") {
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setEmpresas((lista) => lista.map((e) => (e.id === id ? { ...e, estado } : e)));
      toast({ title: estado === "APROBADA" ? "Empresa aprobada" : "Empresa rechazada" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo guardar", variant: "destructive" });
    }
  }

  async function eliminar(id: string) {
    setEliminando(id);
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((d) => d.filter((x) => x.id !== id));
      toast({ title: "Documento retirado del lote" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
      setEliminando(null);
    }
  }

  function exportarCsv() {
    const params = new URLSearchParams();
    if (empresaFiltro !== "todas") params.set("empresaId", empresaFiltro);
    if (trimestre !== "todos") params.set("trimestre", trimestre);
    const q = params.toString();
    window.open(`/api/documents/export${q ? `?${q}` : ""}`, "_blank");
    toast({
      title: "Lote de asientos generado",
      description: `Archivo CSV listo para importar en a3, Sage o Holded (${filtrados.length} asientos).`,
    });
  }

  if (!gestoria) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Su cuenta no tiene gestoría asociada.
      </div>
    );
  }

  const NAV: Array<{ id: Vista; etiqueta: string; icono: React.ReactNode; contador?: number }> = [
    { id: "resumen", etiqueta: "Resumen", icono: <LayoutDashboard className="h-4 w-4" /> },
    { id: "empresas", etiqueta: "Empresas", icono: <Building2 className="h-4 w-4" />, contador: empresas.length },
    { id: "bandeja", etiqueta: "Bandeja de revisión", icono: <Inbox className="h-4 w-4" />, contador: bandeja.length },
    { id: "exportar", etiqueta: "Exportar", icono: <FileDown className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Panel lateral institucional */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform lg:static lg:translate-x-0",
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--sidebar)" }}
        aria-label="Navegación de la gestoría"
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif text-base font-bold leading-tight text-sidebar-foreground">
              TicketFiscal <span className="text-sidebar-primary">AI</span>
            </p>
            <p className="text-[11px] text-sidebar-foreground/70">{gestoria.nombre}</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setVista(n.id);
                setMenuAbierto(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                vista === n.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
              aria-current={vista === n.id ? "page" : undefined}
            >
              {n.icono}
              <span className="flex-1 text-left">{n.etiqueta}</span>
              {typeof n.contador === "number" && n.contador > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    n.id === "bandeja" ? "bg-amber-400/90 text-amber-950" : "bg-sidebar-accent text-sidebar-foreground"
                  )}
                >
                  {n.contador}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="mb-3 px-2">
            <p className="text-xs font-medium text-sidebar-foreground">{usuario.nombre}</p>
            <p className="text-[11px] text-sidebar-foreground/60">{usuario.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 lg:hidden"
                onClick={() => setMenuAbierto(true)}
                aria-label="Abrir menú"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-serif text-lg font-semibold tracking-tight">
                  {vista === "resumen" && "Resumen de la cartera"}
                  {vista === "empresas" && "Empresas de la gestoría"}
                  {vista === "bandeja" && "Bandeja de revisión"}
                  {vista === "exportar" && "Exportar lote de asientos"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {docs.length} justificantes en total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                <SelectTrigger className="h-9 w-[180px] text-xs" aria-label="Filtrar por empresa">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={() => {
                  setCargando(true);
                  void cargar();
                }}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-6">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando la cartera…
            </div>
          ) : (
            <>
              {vista === "resumen" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <Kpi icono={<Inbox className="h-5 w-5 text-primary" />} valor={filtrados.length} etiqueta="Documentos en el lote" fondo="bg-secondary" />
                    <Kpi icono={<TriangleAlert className="h-5 w-5 text-amber-600" />} valor={resumen.pendientes} etiqueta="Pendientes de revisión" fondo="bg-amber-100" />
                    <Kpi icono={<CheckCircle2 className="h-5 w-5 text-emerald-700" />} valor={`${resumen.ivaDeducible.toFixed(2)} €`} etiqueta="IVA soportado deducible" fondo="bg-emerald-100" />
                    <Kpi icono={<Calculator className="h-5 w-5 text-primary" />} valor={`${resumen.retenciones.toFixed(2)} €`} etiqueta="Retenciones de IRPF" fondo="bg-secondary" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                    <TablaDocumentos
                      docs={filtrados}
                      nombresEmpresas={nombresEmpresas}
                      trimestre={trimestre}
                      setTrimestre={setTrimestre}
                      trimestres={trimestres}
                      onDetalle={setDetalle}
                      onEliminar={eliminar}
                  onAprobar={(id) => void revisarDocumento(id, "APROBADO")}
                  onRechazar={(id) => void revisarDocumento(id, "RECHAZADO")}
                      eliminando={eliminando}
                      vacio="Sin justificantes con estos filtros. En cuanto una empresa reenvíe su primer ticket por WhatsApp, aparecerá aquí en segundos."
                    />

                    <Card className="h-fit">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Calculator className="h-4 w-4 text-primary" />
                          Autoliquidación Modelo 303
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {trimestre === "todos"
                            ? "Acumulado de todos los trimestres"
                            : `${trimestre} (IVA soportado)`}
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
                                <span className="text-sm text-muted-foreground">Cuota soportada: </span>
                                <span className="text-base font-bold tabular-nums text-emerald-700">
                                  {linea.cuota.toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(resumen.porTipo).length === 0 && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            Aún no hay IVA soportado deducible en este período. Las facturas
                            simplificadas sin NIF del destinatario no son deducibles (art. 97 LIVA).
                          </p>
                        )}
                        <div className="rounded-lg border-2 border-emerald-700/30 bg-emerald-50 p-3">
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-semibold">Total IVA soportado</span>
                            <span className="text-xl font-bold tabular-nums text-emerald-700">
                              {resumen.ivaDeducible.toFixed(2)} €
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                            Solo se computan facturas completas o simplificadas cualificadas con
                            derecho a deducción.
                          </p>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Los totales se calculan sobre las bases y cuotas extraídas por fecha de
                          devengo. Revise la bandeja antes de presentar el Modelo 303.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {vista === "empresas" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {empresas.map((e) => (
                      <button
                        key={e.id}
                        className="group rounded-xl border bg-card p-5 text-left transition hover:border-primary/50 hover:shadow-sm"
                        onClick={() => {
                          setEmpresaFiltro(e.id);
                          setVista("resumen");
                        }}
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="rounded-lg bg-secondary p-2.5">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          {e.estado === "PENDIENTE" ? (
                            <Badge className="bg-sky-700 text-[10px]">Pendiente de aprobación</Badge>
                          ) : e.estado === "RECHAZADA" ? (
                            <Badge className="bg-red-700 text-[10px]">Rechazada</Badge>
                          ) : e.pendientes > 0 ? (
                            <Badge className="bg-amber-600 text-[10px]">{e.pendientes} a revisar</Badge>
                          ) : (
                            <Badge className="bg-emerald-700 text-[10px]">Al día</Badge>
                          )}
                        </div>
                        {e.estado === "PENDIENTE" && (
                          <div
                            className="mb-3 flex gap-2"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <Button size="sm" className="h-8 text-xs" onClick={() => void cambiarEstadoEmpresa(e.id, "APROBADA")}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Aprobar alta
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void cambiarEstadoEmpresa(e.id, "RECHAZADA")}>
                              <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                            </Button>
                          </div>
                        )}
                        <h3 className="font-serif text-base font-semibold leading-snug">{e.nombre}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          NIF {e.nif}
                          {e.ciudad ? ` · ${e.ciudad}` : ""}
                          {e.whatsapp ? ` · ${e.whatsapp}` : ""}
                        </p>
                        <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Docs</dt>
                            <dd className="text-sm font-bold tabular-nums">{e.documentos}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">IVA sop.</dt>
                            <dd className="text-sm font-bold tabular-nums text-emerald-700">
                              {e.ivaDeducible.toFixed(0)} €
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Último</dt>
                            <dd className="text-sm font-bold tabular-nums">{e.ultimoDocumento ?? "—"}</dd>
                          </div>
                        </dl>
                      </button>
                    ))}
                  </div>
                  {empresas.length === 0 && (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Aún no hay empresas asignadas a la gestoría. Cuando dé de alta la primera
                      empresa y vincule su número de WhatsApp autorizado, los justificantes
                      empezarán a llegar solos.
                    </div>
                  )}
                </div>
              )}

              {vista === "bandeja" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Cada pendiente muestra su motivo exacto.</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Descuadres aritméticos, dígitos de control erróneos, justificantes ilegibles
                      y facturas simplificadas sin derecho a deducción. La confianza nace de ver el
                      cálculo, no de fiarse de la IA.
                    </p>
                  </div>
                  {bandeja.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Bandeja al día: no queda ningún documento pendiente de revisión.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bandeja.map((d) => (
                        <Card key={d.id} className="border-l-4 border-l-amber-500">
                          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <Badge
                                  className={cn(
                                    "text-[10px]",
                                    d.estado === "REQUIERE_REVISION" ? "bg-amber-600" : "bg-red-700"
                                  )}
                                >
                                  {d.estado === "REQUIERE_REVISION" ? "A revisar" : "Ilegible"}
                                </Badge>
                                <span className="text-xs font-medium">
                                  {nombresEmpresas.get(d.empresaId) ?? "Empresa"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {d.numeroFactura ?? "sin número"} · {d.fechaEmision ?? "sin fecha"}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground/90">
                                {d.motivoRevision ?? "Sin motivo registrado."}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {d.emisorNombre ?? "Emisor ilegible"}
                                {d.emisorNif ? ` · ${d.emisorNif}` : ""}
                                {d.nifEmisorValido === false ? " · NIF con dígito de control no válido" : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDetalle(d)} aria-label="Ver detalle">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={eliminando === d.id}
                                onClick={() => void eliminar(d.id)}
                                aria-label="Retirar documento"
                              >
                                {eliminando === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {vista === "exportar" && (
                <div className="mx-auto max-w-2xl space-y-5">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileDown className="h-4 w-4 text-primary" />
                        Lote de asientos para su ERP
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            Empresa
                          </label>
                          <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                            <SelectTrigger className="h-10 text-sm" aria-label="Empresa a exportar">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">Todas las empresas</SelectItem>
                              {empresas.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            Trimestre (Modelo 303)
                          </label>
                          <Select value={trimestre} onValueChange={setTrimestre}>
                            <SelectTrigger className="h-10 text-sm" aria-label="Trimestre a exportar">
                              <SelectValue />
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
                        </div>
                      </div>

                      <div className="rounded-lg border bg-secondary/50 p-4 text-sm">
                        <p className="font-semibold">
                          {filtrados.length} asientos listos para exportar
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Base imponible total: {filtrados.reduce((s, d) => s + d.baseImponible, 0).toFixed(2)} € ·
                          IVA soportado deducible: {resumen.ivaDeducible.toFixed(2)} € ·
                          Retenciones: {resumen.retenciones.toFixed(2)} €.
                          Los documentos en estado «A revisar» o «Ilegible» se incluyen marcados
                          para que decida si los contabiliza.
                        </p>
                      </div>

                      <Button className="w-full" size="lg" onClick={exportarCsv} disabled={filtrados.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exportar lote de asientos (CSV)
                      </Button>
                      <p className="text-center text-[11px] text-muted-foreground">
                        Formato contable español: separador «;», decimales con coma y BOM UTF-8.
                        Importación directa en a3, Sage y Holded.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </main>

        <footer className="mt-auto border-t bg-white/95 px-4 py-3 lg:px-6">
          <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {gestoria.nombre} · {usuario.nombre} — TicketFiscal AI
            </span>
            <span className="flex items-center gap-1.5">
              Verifique cada asiento antes de presentar las autoliquidaciones ante la AEAT.
            </span>
          </p>
        </footer>
      </div>

      <DialogoDetalle doc={detalle} onClose={() => setDetalle(null)} nombreEmpresa={detalle ? nombresEmpresas.get(detalle.empresaId) : undefined} />
    </div>
  );
}

function Kpi({
  icono,
  valor,
  etiqueta,
  fondo,
}: {
  icono: React.ReactNode;
  valor: string | number;
  etiqueta: string;
  fondo: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2.5", fondo)}>{icono}</div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tabular-nums xl:text-2xl">{valor}</p>
          <p className="text-xs text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TablaDocumentos({
  docs,
  nombresEmpresas,
  trimestre,
  setTrimestre,
  trimestres,
  onDetalle,
  onEliminar,
  onAprobar,
  onRechazar,
  eliminando,
  vacio,
}: {
  docs: Documento[];
  nombresEmpresas: Map<string, string>;
  trimestre: string;
  setTrimestre: (t: string) => void;
  trimestres: string[];
  onDetalle: (d: Documento) => void;
  onEliminar: (id: string) => void;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
  eliminando: string | null;
  vacio: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="text-base">Lote de asientos</CardTitle>
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger className="h-9 w-[190px] text-xs" aria-label="Filtrar por trimestre">
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
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{vacio}</div>
        ) : (
          <div className="max-h-[26rem] overflow-auto rounded-md border">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Empresa</TableHead>
                  <TableHead className="text-xs">Nº / Emisor</TableHead>
                  <TableHead className="text-xs">PGC</TableHead>
                  <TableHead className="text-right text-xs">Base</TableHead>
                  <TableHead className="text-right text-xs">IVA</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-center text-xs">Estado</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => onDetalle(d)}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {d.fechaEmision ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[130px]">
                      <p className="truncate text-xs font-medium">
                        {nombresEmpresas.get(d.empresaId) ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[170px]">
                      <p className="truncate text-xs font-medium">{d.numeroFactura ?? "—"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.emisorNombre ?? "—"}
                      </p>
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
                            ? "bg-emerald-700"
                            : d.estado === "REQUIERE_REVISION"
                              ? "bg-amber-600"
                              : "bg-red-700"
                        )}
                      >
                        {d.estado === "VALIDO" ? "Válido" : d.estado === "REQUIERE_REVISION" ? "Revisar" : "Ilegible"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onDetalle(d)}
                          aria-label="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {d.revision !== "APROBADO" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-700 hover:text-emerald-700"
                            onClick={() => onAprobar(d.id)}
                            aria-label="Aprobar justificante"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {d.revision === "PENDIENTE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-700 hover:text-amber-700"
                            onClick={() => onRechazar(d.id)}
                            aria-label="Rechazar justificante"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={eliminando === d.id}
                          onClick={() => void onEliminar(d.id)}
                          aria-label="Retirar documento"
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
  );
}

function DialogoDetalle({
  doc,
  onClose,
  nombreEmpresa,
}: {
  doc: Documento | null;
  onClose: () => void;
  nombreEmpresa?: string;
}) {
  if (!doc) return null;
  const filas: Array<[string, string]> = [
    ["Empresa", nombreEmpresa ?? "—"],
    ["Estado", doc.estado],
    ["Tipo de documento", doc.tipoDocumento],
    ["IVA deducible", doc.ivaDeducible ? "Sí" : "No"],
    ["Emisor", `${doc.emisorNombre ?? "—"} (${doc.emisorNif ?? "sin NIF"})`],
    [
      "NIF emisor válido",
      doc.nifEmisorValido === true
        ? "Sí · dígito de control verificado"
        : doc.nifEmisorValido === false
          ? "NO · dígito de control erróneo"
          : "sin validar",
    ],
    ["Receptor", `${doc.receptorNombre ?? "—"} (${doc.receptorNif ?? "sin NIF"})`],
    [
      "NIF receptor válido",
      doc.nifReceptorValido === true
        ? "Sí · dígito de control verificado"
        : doc.nifReceptorValido === false
          ? "NO · dígito de control erróneo"
          : "sin validar",
    ],
    ["Nº factura", doc.numeroFactura ?? "—"],
    ["Fecha de devengo", doc.fechaEmision ?? "—"],
    ["Cuenta PGC", etiquetaCuenta(doc.cuentaPgc)],
    ["Base imponible", `${doc.baseImponible.toFixed(2)} €`],
    [`Cuota IVA soportada (${doc.porcentajeIva}%)`, `${doc.cuotaIva.toFixed(2)} €`],
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
                  ? "bg-emerald-700"
                  : doc.estado === "REQUIERE_REVISION"
                    ? "bg-amber-600"
                    : "bg-red-700"
              }
            >
              {doc.estado === "VALIDO" ? "Válido" : doc.estado === "REQUIERE_REVISION" ? "Revisar" : "Ilegible"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {nombreEmpresa ? `${nombreEmpresa} · ` : ""}
            {doc.trimestre ? `Trimestre ${doc.trimestre} · ` : ""}
            {doc.imagenNombre ? `Archivo: ${doc.imagenNombre}` : "Enviado por WhatsApp"}
          </DialogDescription>
        </DialogHeader>

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

