"use client";

// Gestión de cuentas: gestorías, usuarios y empresas.
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Building2, Check, LifeBuoy, Pause, Play, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useAdmin, useDatos } from "./api";
import { Cargando, DialogoMotivo, EstadoBadge, Paginacion, Vacio, fechaHora, type Pagina } from "./compartidos";

/** Ejecuta una acción PATCH/POST contra la API y avisa del resultado. */
function useAcciones(recargar: () => void) {
  const { llamar } = useAdmin();
  return useCallback(
    async (ruta: string, cuerpo: unknown, exito: string, metodo = "PATCH"): Promise<boolean> => {
      const r = await llamar(ruta, { metodo, cuerpo });
      if (r.ok) {
        toast({ title: exito });
        recargar();
        return true;
      }
      toast({ title: "No se pudo completar la acción", description: r.datos.error, variant: "destructive" });
      return false;
    },
    [llamar, recargar]
  );
}

function Filtros({
  q,
  setQ,
  estado,
  setEstado,
  estados,
  extra,
  onBuscar,
}: {
  q: string;
  setQ: (v: string) => void;
  estado: string;
  setEstado: (v: string) => void;
  estados: string[];
  extra?: React.ReactNode;
  onBuscar: () => void;
}) {
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onBuscar();
      }}
    >
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por nombre, NIF o e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Select value={estado} onValueChange={setEstado}>
        <SelectTrigger className="w-[170px]" aria-label="Filtrar por estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {estados.map((e) => (
            <SelectItem key={e} value={e}>
              {e.charAt(0) + e.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {extra}
      <Button type="submit" variant="secondary">
        Buscar
      </Button>
    </form>
  );
}

function consulta(base: string, p: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "" && v !== "todos") s.set(k, String(v));
  return `${base}?${s.toString()}`;
}

// ------------------------------------------------------------------ Gestorías

interface FilaGestoria {
  id: string;
  nombre: string;
  cif: string | null;
  estado: string;
  motivoSuspension: string | null;
  createdAt: string;
  empresas: number;
  usuarios: number;
  contacto: { email: string; nombre: string } | null;
}

export function SeccionGestorias({ estadoInicial = "todos" }: { estadoInicial?: string }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(estadoInicial);
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [aplicado, setAplicado] = useState({ q: "", estado: estadoInicial });
  const [suspender, setSuspender] = useState<FilaGestoria | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const accion = useAcciones(recargar);

  const { datos, error, cargando } = useDatos<Pagina<FilaGestoria>>(consulta("/api/admin/gestorias", { q: aplicado.q, estado: aplicado.estado, pagina }), version);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Filtros
          q={q}
          setQ={setQ}
          estado={estado}
          setEstado={setEstado}
          estados={["PENDIENTE", "ACTIVA", "SUSPENDIDA"]}
          onBuscar={() => {
            setPagina(1);
            setAplicado({ q, estado });
          }}
        />
        {cargando && <Cargando />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {datos && datos.filas.length === 0 && <Vacio texto="No hay gestorías con esos filtros." />}
        {datos && datos.filas.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[820px]">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Gestoría</TableHead>
                    <TableHead className="text-xs">Contacto</TableHead>
                    <TableHead className="text-center text-xs">Empresas</TableHead>
                    <TableHead className="text-center text-xs">Usuarios</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Alta</TableHead>
                    <TableHead className="w-48" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{g.nombre}</p>
                        <p className="text-xs text-muted-foreground">{g.cif ?? "Sin CIF"}</p>
                      </TableCell>
                      <TableCell className="text-xs">{g.contacto ? `${g.contacto.nombre} · ${g.contacto.email}` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{g.empresas}</TableCell>
                      <TableCell className="text-center tabular-nums">{g.usuarios}</TableCell>
                      <TableCell>
                        <EstadoBadge estado={g.estado} />
                        {g.motivoSuspension && <p className="mt-1 max-w-[200px] truncate text-[11px] text-muted-foreground" title={g.motivoSuspension}>{g.motivoSuspension}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fechaHora(g.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDetalle(g.id)}>
                            <Building2 className="mr-1 h-3.5 w-3.5" /> Detalle
                          </Button>
                          {g.estado === "PENDIENTE" && (
                            <Button size="sm" className="h-8 text-xs" onClick={() => void accion(`/api/admin/gestorias/${g.id}`, { estado: "ACTIVA" }, "Gestoría aprobada")}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Aprobar
                            </Button>
                          )}
                          {g.estado === "ACTIVA" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSuspender(g)}>
                              <Pause className="mr-1 h-3.5 w-3.5" /> Suspender
                            </Button>
                          )}
                          {g.estado === "SUSPENDIDA" && (
                            <Button size="sm" className="h-8 text-xs" onClick={() => void accion(`/api/admin/gestorias/${g.id}`, { estado: "ACTIVA" }, "Gestoría reactivada")}>
                              <Play className="mr-1 h-3.5 w-3.5" /> Reactivar
                            </Button>
                          )}
                        </div>
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

      <DialogoMotivo
        abierto={suspender !== null}
        titulo={`Suspender «${suspender?.nombre ?? ""}»`}
        descripcion="Se cerrarán al instante las sesiones de sus gestores. Podrá reactivarla sin un alta nueva."
        etiquetaBoton="Suspender gestoría"
        minimo={5}
        peligro
        onCerrar={() => setSuspender(null)}
        onConfirmar={async (motivo) => {
          if (suspender && (await accion(`/api/admin/gestorias/${suspender.id}`, { estado: "SUSPENDIDA", motivo }, "Gestoría suspendida"))) setSuspender(null);
        }}
      />
      <DetalleGestoria id={detalle} onCerrar={() => setDetalle(null)} />
    </Card>
  );
}

interface DetalleG {
  nombre: string;
  usuarios: Array<{ id: string; nombre: string; email: string; estado: string; ultimoAcceso: string | null }>;
  empresas: Array<{ id: string; nombre: string; nif: string; estado: string; documentos: number }>;
}

function DetalleGestoria({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { datos, cargando } = useDatos<DetalleG>(id ? `/api/admin/gestorias/${id}` : null);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{datos?.nombre ?? "Gestoría"}</DialogTitle>
        </DialogHeader>
        {cargando && <Cargando />}
        {datos && (
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuarios ({datos.usuarios.length})</h3>
              <ul className="divide-y rounded-md border">
                {datos.usuarios.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {u.nombre} <span className="text-xs text-muted-foreground">· {u.email}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {fechaHora(u.ultimoAcceso)} <EstadoBadge estado={u.estado} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresas ({datos.empresas.length})</h3>
              {datos.empresas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún sin empresas.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {datos.empresas.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {e.nombre} <span className="text-xs text-muted-foreground">· {e.nif}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {e.documentos} docs <EstadoBadge estado={e.estado} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Usuarios

interface FilaUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado: string;
  motivoSuspension: string | null;
  ultimoAcceso: string | null;
  gestoria: { nombre: string } | null;
  empresa: { nombre: string; gestoria: { nombre: string } | null } | null;
}

export function SeccionUsuarios() {
  const { llamar } = useAdmin();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [rol, setRol] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [aplicado, setAplicado] = useState({ q: "", estado: "todos", rol: "todos" });
  const [suspender, setSuspender] = useState<FilaUsuario | null>(null);
  const [soporte, setSoporte] = useState<FilaUsuario | null>(null);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const accion = useAcciones(recargar);

  const { datos, error, cargando } = useDatos<Pagina<FilaUsuario>>(
    consulta("/api/admin/usuarios", { q: aplicado.q, estado: aplicado.estado, rol: aplicado.rol, pagina }),
    version
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Filtros
          q={q}
          setQ={setQ}
          estado={estado}
          setEstado={setEstado}
          estados={["ACTIVA", "SUSPENDIDA"]}
          extra={
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger className="w-[150px]" aria-label="Filtrar por perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los perfiles</SelectItem>
                <SelectItem value="GESTOR">Gestores</SelectItem>
                <SelectItem value="CLIENTE">Clientes</SelectItem>
              </SelectContent>
            </Select>
          }
          onBuscar={() => {
            setPagina(1);
            setAplicado({ q, estado, rol });
          }}
        />
        {cargando && <Cargando />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {datos && datos.filas.length === 0 && <Vacio texto="No hay usuarios con esos filtros." />}
        {datos && datos.filas.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Usuario</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Vinculado a</TableHead>
                    <TableHead className="text-xs">Último acceso</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="w-56" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{u.nombre}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell className="text-xs">{u.rol === "GESTOR" ? "Gestor" : u.rol === "CLIENTE" ? "Cliente" : "Administrador"}</TableCell>
                      <TableCell className="text-xs">
                        {u.gestoria?.nombre ?? u.empresa?.nombre ?? "—"}
                        {u.empresa?.gestoria && <span className="text-muted-foreground"> · {u.empresa.gestoria.nombre}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fechaHora(u.ultimoAcceso)}</TableCell>
                      <TableCell>
                        <EstadoBadge estado={u.estado} />
                      </TableCell>
                      <TableCell>
                        {u.rol !== "ADMIN" && (
                          <div className="flex justify-end gap-1">
                            {u.estado === "ACTIVA" && (
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSoporte(u)}>
                                <LifeBuoy className="mr-1 h-3.5 w-3.5" /> Soporte
                              </Button>
                            )}
                            {u.estado === "ACTIVA" ? (
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSuspender(u)}>
                                <Pause className="mr-1 h-3.5 w-3.5" /> Suspender
                              </Button>
                            ) : (
                              <Button size="sm" className="h-8 text-xs" onClick={() => void accion(`/api/admin/usuarios/${u.id}`, { estado: "ACTIVA" }, "Usuario reactivado")}>
                                <Play className="mr-1 h-3.5 w-3.5" /> Reactivar
                              </Button>
                            )}
                          </div>
                        )}
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

      <DialogoMotivo
        abierto={suspender !== null}
        titulo={`Suspender a ${suspender?.nombre ?? ""}`}
        descripcion="Se cierra su sesión al instante. Sus datos se conservan y podrá reactivarlo cuando quiera."
        etiquetaBoton="Suspender usuario"
        minimo={5}
        peligro
        onCerrar={() => setSuspender(null)}
        onConfirmar={async (motivo) => {
          if (suspender && (await accion(`/api/admin/usuarios/${suspender.id}`, { estado: "SUSPENDIDA", motivo }, "Usuario suspendido"))) setSuspender(null);
        }}
      />
      <DialogoMotivo
        abierto={soporte !== null}
        titulo={`Entrar como ${soporte?.nombre ?? ""}`}
        descripcion="Sesión de soporte de 30 minutos. Queda registrada en la auditoría y el usuario verá un aviso mientras dure."
        etiquetaBoton="Abrir sesión de soporte"
        minimo={10}
        onCerrar={() => setSoporte(null)}
        onConfirmar={async (motivo) => {
          if (!soporte) return;
          const r = await llamar(`/api/admin/usuarios/${soporte.id}/impersonar`, { metodo: "POST", cuerpo: { motivo } });
          if (r.ok) router.push("/"); // la portada lee la sesión de soporte al montarse
          else toast({ title: "No se pudo abrir la sesión", description: r.datos.error, variant: "destructive" });
        }}
      />
    </Card>
  );
}

// ------------------------------------------------------------------ Empresas

interface FilaEmpresa {
  id: string;
  nombre: string;
  nif: string;
  whatsapp: string | null;
  estado: string;
  motivoSuspension: string | null;
  documentos: number;
  gestoria: { id: string; nombre: string } | null;
  createdAt: string;
}

export function SeccionEmpresas() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [aplicado, setAplicado] = useState({ q: "", estado: "todos" });
  const [suspender, setSuspender] = useState<FilaEmpresa | null>(null);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const accion = useAcciones(recargar);

  const { datos, error, cargando } = useDatos<Pagina<FilaEmpresa>>(consulta("/api/admin/empresas", { q: aplicado.q, estado: aplicado.estado, pagina }), version);

  const cambiar = (id: string, estado: string, texto: string) => accion(`/api/admin/empresas/${id}`, { estado }, texto);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Filtros
          q={q}
          setQ={setQ}
          estado={estado}
          setEstado={setEstado}
          estados={["PENDIENTE", "APROBADA", "RECHAZADA", "SUSPENDIDA"]}
          onBuscar={() => {
            setPagina(1);
            setAplicado({ q, estado });
          }}
        />
        {cargando && <Cargando />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {datos && datos.filas.length === 0 && <Vacio texto="No hay empresas con esos filtros." />}
        {datos && datos.filas.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Empresa</TableHead>
                    <TableHead className="text-xs">Gestoría</TableHead>
                    <TableHead className="text-xs">WhatsApp</TableHead>
                    <TableHead className="text-center text-xs">Docs</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="w-52" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{e.nombre}</p>
                        <p className="text-xs text-muted-foreground">{e.nif}</p>
                      </TableCell>
                      <TableCell className="text-xs">{e.gestoria?.nombre ?? <span className="text-muted-foreground">Sin gestoría</span>}</TableCell>
                      <TableCell className="text-xs tabular-nums">{e.whatsapp ?? "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{e.documentos}</TableCell>
                      <TableCell>
                        <EstadoBadge estado={e.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(e.estado === "PENDIENTE" || e.estado === "RECHAZADA" || e.estado === "SUSPENDIDA") && (
                            <Button size="sm" className="h-8 text-xs" onClick={() => void cambiar(e.id, "APROBADA", e.estado === "SUSPENDIDA" ? "Empresa reactivada" : "Empresa aprobada")}>
                              <Check className="mr-1 h-3.5 w-3.5" /> {e.estado === "SUSPENDIDA" ? "Reactivar" : "Aprobar"}
                            </Button>
                          )}
                          {e.estado === "PENDIENTE" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void cambiar(e.id, "RECHAZADA", "Empresa rechazada")}>
                              <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                            </Button>
                          )}
                          {e.estado === "APROBADA" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSuspender(e)}>
                              <Pause className="mr-1 h-3.5 w-3.5" /> Suspender
                            </Button>
                          )}
                        </div>
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
      <DialogoMotivo
        abierto={suspender !== null}
        titulo={`Suspender «${suspender?.nombre ?? ""}»`}
        descripcion="La empresa deja de poder enviar justificantes y se cierran las sesiones de sus usuarios."
        etiquetaBoton="Suspender empresa"
        minimo={5}
        peligro
        onCerrar={() => setSuspender(null)}
        onConfirmar={async (motivo) => {
          if (suspender && (await accion(`/api/admin/empresas/${suspender.id}`, { estado: "SUSPENDIDA", motivo }, "Empresa suspendida"))) setSuspender(null);
        }}
      />
    </Card>
  );
}
