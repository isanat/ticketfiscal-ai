"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface Pagina<T> {
  filas: T[];
  total: number;
  pagina: number;
  paginas: number;
}

const ESTILOS: Record<string, string> = {
  ACTIVA: "bg-emerald-700",
  APROBADA: "bg-emerald-700",
  PENDIENTE: "bg-amber-600",
  SUSPENDIDA: "bg-red-700",
  RECHAZADA: "bg-slate-600",
};

const ETIQUETAS: Record<string, string> = {
  ACTIVA: "Activa",
  APROBADA: "Aprobada",
  PENDIENTE: "Pendiente",
  SUSPENDIDA: "Suspendida",
  RECHAZADA: "Rechazada",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return <Badge className={cn("text-[10px]", ESTILOS[estado] ?? "bg-slate-600")}>{ETIQUETAS[estado] ?? estado}</Badge>;
}

export function fechaHora(v: string | Date | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function Paginacion({ pagina, paginas, total, onCambiar }: { pagina: number; paginas: number; total: number; onCambiar: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
      <span>
        {total} {total === 1 ? "resultado" : "resultados"}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 tabular-nums">
          {pagina} / {paginas}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)} aria-label="Página siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Diálogo que pide un motivo (obligatorio o no) antes de ejecutar una acción. */
export function DialogoMotivo({
  abierto,
  titulo,
  descripcion,
  etiquetaBoton,
  minimo = 0,
  peligro,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: ReactNode;
  etiquetaBoton: string;
  minimo?: number;
  peligro?: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    await onConfirmar(motivo.trim());
    setEnviando(false);
    setMotivo("");
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="motivo">Motivo{minimo > 0 ? ` (mín. ${minimo} caracteres)` : " (opcional)"}</Label>
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant={peligro ? "destructive" : "default"} disabled={enviando || motivo.trim().length < minimo} onClick={() => void enviar()}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {etiquetaBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Cargando({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-2 py-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{texto}</p>;
}
