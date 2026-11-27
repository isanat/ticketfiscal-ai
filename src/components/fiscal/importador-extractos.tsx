"use client";

// Importación de extractos bancarios: arrastrar o elegir varios archivos (CSV o Norma 43), ver qué se leería
// y confirmar. El formato se detecta solo. Nada se guarda hasta confirmar.
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileUp, FileWarning, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { eur, fechaEs } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Vista {
  formato: "csv" | "n43";
  total: number;
  nuevos: number;
  duplicados: number;
  ignoradas: number;
  cargos: number;
  abonos: number;
  importeCargos: number;
  importeAbonos: number;
  desde: string | null;
  hasta: string | null;
  ejemplos: Array<{ fecha: string; descripcion: string; importe: number }>;
  avisos: string[];
}
interface Pendiente {
  nombre: string;
  contenido: string;
  vista?: Vista;
  error?: string;
}

const MAX_BYTES = 2_000_000;
const MAX_ARCHIVOS = 12;
const EXTENSIONES = ".csv,.txt,.n43,.c43,.q43,.aeb43,.tsv,text/csv,text/plain";

/** Los extractos de banco (sobre todo Norma 43) suelen venir en ISO-8859-1. */
async function leerArchivo(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("iso-8859-1").decode(buf) : utf8;
}

export function ImportadorExtractos({ empresaId, onImportado }: { empresaId: string; onImportado: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);

  async function preparar(archivos: File[]) {
    if (archivos.length === 0) return;
    setLeyendo(true);
    const lista: Pendiente[] = [];
    for (const f of archivos.slice(0, MAX_ARCHIVOS)) {
      if (f.size > MAX_BYTES) {
        lista.push({ nombre: f.name, contenido: "", error: "Supera 2 MB. Descargue un periodo más corto." });
        continue;
      }
      try {
        const contenido = await leerArchivo(f);
        const res = await fetch("/api/conciliacion/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId: empresaId || undefined, formato: "auto", contenido, soloVista: true }),
        });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) lista.push({ nombre: f.name, contenido, error: js.error ?? "No se pudo leer el archivo." });
        else if (!js.vista || js.vista.total === 0) {
          lista.push({ nombre: f.name, contenido, error: "No se reconoció ningún movimiento. Compruebe que es un extracto CSV (con cabecera Fecha, Concepto, Importe) o Norma 43." });
        } else lista.push({ nombre: f.name, contenido, vista: js.vista });
      } catch {
        lista.push({ nombre: f.name, contenido: "", error: "No se pudo leer el archivo." });
      }
    }
    if (archivos.length > MAX_ARCHIVOS) toast({ title: `Se leerán solo los ${MAX_ARCHIVOS} primeros archivos`, description: "Importe el resto después." });
    setLeyendo(false);
    setPendientes(lista);
    if (input.current) input.current.value = "";
  }

  async function confirmar() {
    if (!pendientes) return;
    setImportando(true);
    let importados = 0;
    let duplicados = 0;
    let fallos = 0;
    for (const p of pendientes) {
      if (!p.vista) continue;
      const res = await fetch("/api/conciliacion/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: empresaId || undefined, formato: "auto", contenido: p.contenido }),
      });
      const js = await res.json().catch(() => ({}));
      if (res.ok) {
        importados += js.importados ?? 0;
        duplicados += js.duplicados ?? 0;
      } else fallos++;
    }
    setImportando(false);
    setPendientes(null);
    toast({
      title: fallos ? "Importación incompleta" : "Extracto importado",
      description: `${importados} movimientos nuevos${duplicados ? `, ${duplicados} ya existían` : ""}${fallos ? `, ${fallos} archivo(s) fallaron` : ""}.`,
      variant: fallos ? "destructive" : "default",
    });
    onImportado();
  }

  const validos = pendientes?.filter((p) => p.vista) ?? [];
  const nuevosTotal = validos.reduce((s, p) => s + (p.vista?.nuevos ?? 0), 0);

  return (
    <div className="w-full space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Subir extractos bancarios"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void preparar(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition",
          arrastrando ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"
        )}
      >
        {leyendo ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-primary" />}
        <p className="text-sm font-medium">{leyendo ? "Leyendo los archivos…" : "Arrastre aquí sus extractos o haga clic para elegirlos"}</p>
        <p className="text-xs text-muted-foreground">CSV o Norma 43 · puede subir varios meses a la vez · el formato se detecta solo · máx. 2 MB por archivo</p>
        <input ref={input} type="file" multiple accept={EXTENSIONES} className="sr-only" aria-label="Archivos de extracto" onChange={(e) => void preparar(Array.from(e.target.files ?? []))} />
      </div>

      <details className="group rounded-md border bg-card text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium">
          ¿Cómo descargo el extracto de mi banco?
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            En la banca online suele estar en <strong>Cuentas → Movimientos → Descargar / Exportar</strong>. Elija un rango de fechas (un mes o un trimestre) y el formato <strong>Norma 43</strong>{" "}
            (también llamado «AEB 43» o «Cuaderno 43») si su banco lo ofrece; si no, <strong>CSV</strong>. El menú exacto cambia según la entidad.
          </p>
          <p>
            Si solo ofrece Excel, ábralo y guárdelo como <strong>CSV</strong>. Necesita una cabecera con las columnas <em>Fecha</em>, <em>Concepto</em> e <em>Importe</em> (o <em>Cargo</em> y <em>Abono</em>); los gastos deben ir en negativo o en la columna de cargos.
          </p>
          <p>
            Subir dos veces el mismo extracto no duplica nada.{" "}
            <a href="/ejemplo-extracto.csv" download className="font-medium text-primary underline underline-offset-2">
              Descargar un CSV de ejemplo
            </a>
            .
          </p>
        </div>
      </details>

      <Dialog open={pendientes !== null} onOpenChange={(o) => !o && !importando && setPendientes(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <FileUp className="h-5 w-5 text-primary" /> Revise antes de importar
            </DialogTitle>
            <DialogDescription>Esto es lo que se ha leído de cada archivo. No se guarda nada hasta que confirme.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {pendientes?.map((p, i) => (
              <div key={`${p.nombre}-${i}`} className={cn("rounded-lg border p-3", p.error ? "border-red-200 bg-red-50/50" : "bg-card")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{p.nombre}</p>
                  {p.vista ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {p.vista.formato === "n43" ? "Norma 43" : "CSV"}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-700">
                      <FileWarning className="h-3.5 w-3.5" /> No se puede importar
                    </span>
                  )}
                </div>
                {p.error && <p className="mt-1 text-xs text-red-800">{p.error}</p>}
                {p.vista && (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.vista.total} movimientos · del {fechaEs(p.vista.desde)} al {fechaEs(p.vista.hasta)} · {p.vista.cargos} cargos ({eur(p.vista.importeCargos)}) y {p.vista.abonos} abonos ({eur(p.vista.importeAbonos)})
                    </p>
                    <p className="text-xs">
                      <span className="font-medium text-emerald-700">{p.vista.nuevos} nuevos</span>
                      {p.vista.duplicados > 0 && <span className="text-muted-foreground"> · {p.vista.duplicados} ya estaban importados</span>}
                    </p>
                    {p.vista.avisos.map((a) => (
                      <p key={a} className="mt-1 flex items-start gap-1 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
                      </p>
                    ))}
                    {p.vista.ejemplos.length > 0 && (
                      <ul className="mt-2 divide-y rounded border text-xs">
                        {p.vista.ejemplos.map((e, j) => (
                          <li key={j} className="flex items-center justify-between gap-3 px-2 py-1">
                            <span className="shrink-0 text-muted-foreground">{fechaEs(e.fecha)}</span>
                            <span className="min-w-0 flex-1 truncate">{e.descripcion || "—"}</span>
                            <span className={cn("shrink-0 tabular-nums", e.importe < 0 ? "text-foreground" : "text-emerald-700")}>{eur(e.importe)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={importando} onClick={() => setPendientes(null)}>
              Cancelar
            </Button>
            <Button disabled={importando || validos.length === 0} onClick={() => void confirmar()}>
              {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nuevosTotal > 0 ? `Importar ${nuevosTotal} movimientos nuevos` : validos.length > 0 ? "Todo ya estaba importado" : "Nada que importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
