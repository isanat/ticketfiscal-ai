"use client";

// Secciones de sistema: resumen y uso, auditoría, configuración e integraciones, seguridad.
import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useAdmin, useDatos } from "./api";
import { Cargando, Paginacion, Vacio, fechaHora, type Pagina } from "./compartidos";

// ------------------------------------------------------------------ Resumen

interface Resumen {
  gestorias: Record<string, number>;
  empresas: Record<string, number>;
  usuarios: Record<string, { total: number; suspendidos: number }>;
  documentos: { total: number; ultimos30d: number; porDia: Array<{ dia: string; n: number }> };
  ia: {
    llamadas30d: number;
    errores30d: number;
    tokensEntrada30d: number;
    tokensSalida30d: number;
    porProveedor: Array<{ proveedor: string; modelo: string | null; ok: boolean; llamadas: number; entrada: number; salida: number; msMedio: number }>;
    porDia: Array<{ dia: string; n: number }>;
  };
  topEmpresas: Array<{ empresa: string; n: number }>;
  pendientesDeAprobacion: number;
}

const n = (v: number) => v.toLocaleString("es-ES");

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{valor}</p>
        {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

function Barras({ serie, etiqueta }: { serie: Array<{ dia: string; n: number }>; etiqueta: string }) {
  const max = Math.max(1, ...serie.map((s) => s.n));
  if (serie.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos en los últimos 30 días.</p>;
  return (
    <div className="flex h-28 items-end gap-1" role="img" aria-label={etiqueta}>
      {serie.map((s) => (
        <div key={s.dia} className="group relative flex-1">
          <div className="rounded-t bg-emerald-700/80 transition group-hover:bg-emerald-700" style={{ height: `${Math.max(4, (s.n / max) * 100)}%` }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
            {s.dia.slice(5)} · {s.n}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SeccionResumen({ onIr }: { onIr: (seccion: string) => void }) {
  const { datos, error, cargando } = useDatos<Resumen>("/api/admin/resumen");
  if (cargando) return <Cargando filas={6} />;
  if (error || !datos) return <p className="text-sm text-destructive">{error ?? "Sin datos"}</p>;
  const g = datos.gestorias;
  const totalGestorias = Object.values(g).reduce((s, v) => s + v, 0);
  const totalEmpresas = Object.values(datos.empresas).reduce((s, v) => s + v, 0);
  const totalUsuarios = Object.entries(datos.usuarios).filter(([r]) => r !== "ADMIN").reduce((s, [, v]) => s + v.total, 0);

  return (
    <div className="space-y-6">
      {datos.pendientesDeAprobacion > 0 && (
        <button
          onClick={() => onIr("gestorias")}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {datos.pendientesDeAprobacion === 1 ? "1 gestoría espera su aprobación" : `${datos.pendientesDeAprobacion} gestorías esperan su aprobación`}
          </span>
          <span className="font-medium">Revisar →</span>
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Gestorías" valor={n(totalGestorias)} detalle={`${g.ACTIVA ?? 0} activas · ${g.PENDIENTE ?? 0} pendientes · ${g.SUSPENDIDA ?? 0} suspendidas`} />
        <Kpi titulo="Empresas" valor={n(totalEmpresas)} detalle={`${datos.empresas.APROBADA ?? 0} aprobadas · ${datos.empresas.PENDIENTE ?? 0} pendientes`} />
        <Kpi titulo="Usuarios" valor={n(totalUsuarios)} detalle={`${datos.usuarios.GESTOR?.total ?? 0} gestores · ${datos.usuarios.CLIENTE?.total ?? 0} clientes`} />
        <Kpi titulo="Documentos (30 días)" valor={n(datos.documentos.ultimos30d)} detalle={`${n(datos.documentos.total)} en total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Documentos recibidos por día</CardTitle>
          </CardHeader>
          <CardContent>
            <Barras serie={datos.documentos.porDia} etiqueta="Documentos por día" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Extracciones con IA por día</CardTitle>
          </CardHeader>
          <CardContent>
            <Barras serie={datos.ia.porDia} etiqueta="Extracciones por día" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Uso de la IA (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {n(datos.ia.llamadas30d)} llamadas · {n(datos.ia.errores30d)} con error · {n(datos.ia.tokensEntrada30d)} tokens de entrada · {n(datos.ia.tokensSalida30d)} de salida
            </p>
            {datos.ia.porProveedor.length === 0 ? (
              <Vacio texto="Aún no hay extracciones registradas." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[520px]">
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="text-xs">Proveedor</TableHead>
                      <TableHead className="text-xs">Resultado</TableHead>
                      <TableHead className="text-right text-xs">Llamadas</TableHead>
                      <TableHead className="text-right text-xs">Tokens (ent./sal.)</TableHead>
                      <TableHead className="text-right text-xs">Tiempo medio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.ia.porProveedor.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          {p.proveedor} <span className="text-muted-foreground">{p.modelo}</span>
                        </TableCell>
                        <TableCell>{p.ok ? <Badge className="bg-emerald-700 text-[10px]">Correcta</Badge> : <Badge className="bg-red-700 text-[10px]">Error</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.llamadas)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {n(p.entrada)} / {n(p.salida)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{n(p.msMedio)} ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">El coste en euros no se calcula: depende de la tarifa vigente de cada proveedor.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Empresas más activas</CardTitle>
          </CardHeader>
          <CardContent>
            {datos.topEmpresas.length === 0 ? (
              <Vacio texto="Sin actividad todavía." />
            ) : (
              <ol className="space-y-2 text-sm">
                {datos.topEmpresas.map((e) => (
                  <li key={e.empresa} className="flex justify-between gap-2">
                    <span className="truncate">{e.empresa}</span>
                    <span className="tabular-nums text-muted-foreground">{e.n}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Auditoría

interface FilaAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalle: unknown;
  createdAt: string;
  impersonadoPorId: string | null;
  usuario: { nombre: string; email: string; rol: string } | null;
}

export function SeccionAuditoria() {
  const [accion, setAccion] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aplicada, setAplicada] = useState("");
  const ruta = `/api/admin/auditoria?${new URLSearchParams({ ...(aplicada ? { accion: aplicada } : {}), pagina: String(pagina) })}`;
  const { datos, error, cargando } = useDatos<Pagina<FilaAuditoria>>(ruta);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setAplicada(accion.trim());
          }}
        >
          <Input className="max-w-xs" placeholder="Filtrar por acción (p. ej. gestoria, soporte, usuario)" value={accion} onChange={(e) => setAccion(e.target.value)} />
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
        {cargando && <Cargando />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {datos && datos.filas.length === 0 && <Vacio texto="No hay eventos con ese filtro." />}
        {datos && datos.filas.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Quién</TableHead>
                    <TableHead className="text-xs">Acción</TableHead>
                    <TableHead className="text-xs">Sobre</TableHead>
                    <TableHead className="text-xs">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">{fechaHora(a.createdAt)}</TableCell>
                      <TableCell className="text-xs">
                        {a.usuario ? `${a.usuario.nombre}` : <span className="text-muted-foreground">Sistema</span>}
                        {a.impersonadoPorId && <Badge className="ml-1 bg-sky-700 text-[10px]">en soporte</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.accion}</TableCell>
                      <TableCell className="text-xs">
                        {a.entidad} <span className="text-muted-foreground">{a.entidadId.slice(0, 10)}</span>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate font-mono text-[11px] text-muted-foreground" title={a.detalle ? JSON.stringify(a.detalle) : ""}>
                        {a.detalle ? JSON.stringify(a.detalle) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Paginacion pagina={datos.pagina} paginas={datos.paginas} total={datos.total} onCambiar={setPagina} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Configuración

interface Config {
  valores: { limiteIaDiarioEmpresa: number; proveedorVision: string; registroGestoriasAbierto: boolean; avisoGlobal: string };
}
interface Integraciones {
  integraciones: Array<{ clave: string; nombre: string; configurada: boolean; detalle: string }>;
}

function FormularioConfig({ inicial, onGuardado }: { inicial: Config["valores"]; onGuardado: () => void }) {
  const { llamar } = useAdmin();
  const [v, setV] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const r = await llamar("/api/admin/config", { metodo: "PUT", cuerpo: v });
    setGuardando(false);
    if (r.ok) {
      toast({ title: "Configuración guardada" });
      onGuardado();
    } else toast({ title: "No se pudo guardar", description: r.datos.error, variant: "destructive" });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="limite">Extracciones con IA por empresa y día</Label>
          <Input id="limite" type="number" min={1} max={10000} value={v.limiteIaDiarioEmpresa} onChange={(e) => setV({ ...v, limiteIaDiarioEmpresa: Number(e.target.value) })} />
          <p className="text-[11px] text-muted-foreground">Controla el gasto en IA. Se aplica de inmediato.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proveedor">Proveedor de visión</Label>
          <Select value={v.proveedorVision} onValueChange={(p) => setV({ ...v, proveedorVision: p })}>
            <SelectTrigger id="proveedor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático (según claves)</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
              <SelectItem value="glm">GLM</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Solo cambia cuál se usa; las claves están en Vercel.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="aviso">Aviso para todos los usuarios</Label>
        <Input id="aviso" maxLength={200} value={v.avisoGlobal} onChange={(e) => setV({ ...v, avisoGlobal: e.target.value })} placeholder="Vacío = sin aviso" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={v.registroGestoriasAbierto} onChange={(e) => setV({ ...v, registroGestoriasAbierto: e.target.checked })} />
        Permitir que nuevas gestorías se den de alta (siguen pendientes de su aprobación)
      </label>
      <Button type="submit" disabled={guardando}>
        {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar cambios
      </Button>
    </form>
  );
}

export function SeccionConfiguracion() {
  const [version, setVersion] = useState(0);
  const cfg = useDatos<Config>("/api/admin/config", version);
  const integ = useDatos<Integraciones>("/api/admin/integraciones");
  const recargar = useCallback(() => setVersion((x) => x + 1), []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ajustes del sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {cfg.cargando && <Cargando />}
          {cfg.error && <p className="text-sm text-destructive">{cfg.error}</p>}
          {cfg.datos && <FormularioConfig key={version} inicial={cfg.datos.valores} onGuardado={recargar} />}
          <p className="mt-4 text-[11px] text-muted-foreground">Cada cambio pide su segundo factor y queda en la auditoría.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Integraciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Estado de cada conexión. Las claves se gestionan en Vercel y nunca se muestran aquí.</p>
          {integ.cargando && <Cargando />}
          {integ.datos && (
            <ul className="divide-y rounded-md border">
              {integ.datos.integraciones.map((i) => (
                <li key={i.clave} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{i.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{i.detalle}</span>
                  </span>
                  {i.configurada ? (
                    <Badge className="gap-1 bg-emerald-700 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> Configurada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <CircleDashed className="h-3 w-3" /> Pendiente
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Seguridad

interface FilaSesion {
  id: string;
  createdAt: string;
  expiraEn: string;
  ip: string | null;
  userAgent: string | null;
  impersonadoPorId: string | null;
  usuario: { id: string; nombre: string; email: string; rol: string };
}

export function SeccionSeguridad({ onSalir }: { onSalir: () => void }) {
  const { llamar } = useAdmin();
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const { datos, error, cargando } = useDatos<Pagina<FilaSesion>>(`/api/admin/sesiones?pagina=${pagina}`, version);

  async function revocar(id: string) {
    const r = await llamar(`/api/admin/sesiones?id=${encodeURIComponent(id)}`, { metodo: "DELETE" });
    if (r.ok) {
      toast({ title: "Sesión revocada" });
      setVersion((x) => x + 1);
    } else toast({ title: "No se pudo revocar", description: r.datos.error, variant: "destructive" });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium">Acceso protegido con autenticador (TOTP)</p>
              <p className="text-xs text-muted-foreground">
                Las acciones sensibles piden un código reciente. Si pierde el móvil, use un código de recuperación (se gastan al usarse).
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onSalir}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4" /> Sesiones activas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cargando && <Cargando />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {datos && datos.filas.length === 0 && <Vacio texto="No hay sesiones activas." />}
          {datos && datos.filas.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[720px]">
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="text-xs">Usuario</TableHead>
                      <TableHead className="text-xs">Inicio</TableHead>
                      <TableHead className="text-xs">Caduca</TableHead>
                      <TableHead className="text-xs">IP</TableHead>
                      <TableHead className="text-xs">Navegador</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.filas.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">
                          {s.usuario.nombre} <span className="text-muted-foreground">· {s.usuario.rol.toLowerCase()}</span>
                          {s.impersonadoPorId && <Badge className="ml-1 bg-sky-700 text-[10px]">soporte</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{fechaHora(s.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{fechaHora(s.expiraEn)}</TableCell>
                        <TableCell className="text-xs tabular-nums">{s.ip ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={s.userAgent ?? ""}>
                          {s.userAgent ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void revocar(s.id)}>
                            Revocar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Paginacion pagina={datos.pagina} paginas={datos.paginas} total={datos.total} onCambiar={setPagina} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
