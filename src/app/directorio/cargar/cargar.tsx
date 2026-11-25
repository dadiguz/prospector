"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { FileUp, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { crearProyectoDesdeIdea, importarCarga } from "@/app/actions";
import type { IdeaProyecto, Registro } from "@/lib/carga";
import { ProjectIcon } from "@/lib/project-icons";
import { toast } from "@/components/toaster";

export type ProyectoOpcion = { slug: string; nombre: string; icono: string | null; color: string | null };
type Idea = IdeaProyecto & { creando?: boolean; slug?: string };
type Filtro = "todos" | "con" | "sin" | "sin_info" | "rubro" | "existentes";
const POR_PAGINA = 100;

const GUARDADO = "carga-directorio";
const pillCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`;

type Estado = { registros: Registro[]; ideas: Idea[]; asignado: Record<string, string>; agregados: string[] };
const leerCrudo = () => {
  try {
    return sessionStorage.getItem(GUARDADO);
  } catch {
    return null;
  }
};
const sinSuscripcion = () => () => {};

export function Cargar({ proyectos: inicial }: { proyectos: ProyectoOpcion[] }) {
  const [proyectos, setProyectos] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [archivos, setArchivos] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState<{ hechos: number; total: number; fase: string; detalle?: string } | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  // Lo último que se cargó sigue aquí si sales y regresas (solo en esta pestaña).
  const crudo = useSyncExternalStore(sinSuscripcion, leerCrudo, () => null);
  const [local, setEstadoRaw] = useState<Estado | null | undefined>(undefined);
  const estado: Estado | null = useMemo(() => {
    if (local !== undefined) return local;
    try {
      return crudo ? (JSON.parse(crudo) as Estado) : null;
    } catch {
      return null;
    }
  }, [local, crudo]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [guardando, startGuardar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const setEstado = (f: (e: Estado) => Estado) =>
    setEstadoRaw((prev) => {
      const base = prev === undefined ? estado : prev;
      const n = f(base ?? { registros: [], ideas: [], asignado: {}, agregados: [] });
      try {
        sessionStorage.setItem(GUARDADO, JSON.stringify(n));
      } catch {
        /* sin almacenamiento */
      }
      return n;
    });

  const agregarArchivos = async (fs: FileList | File[]) => {
    const lista = [...fs].filter((f) => f.size < 8_000_000);
    const textos = await Promise.all(lista.map((f) => f.text()));
    setArchivos((a) => [...a, ...lista.map((f) => f.name)]);
    setTexto((t) => [t, ...textos].filter(Boolean).join("\n\n"));
  };

  const leerDatos = async () => {
    setLeyendo({ hechos: 0, total: 0, fase: "Leyendo…" });
    setSel(new Set());
    try {
      const res = await fetch("/api/directorio/cargar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo leer.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let registros: Registro[] = [];
      let ideas: Idea[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const linea = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!linea.trim()) continue;
          const ev = JSON.parse(linea);
          if (ev.tipo === "inicio") {
            setLeyendo({ hechos: 0, total: ev.total, fase: "Leyendo y clasificando…", detalle: ev.negocios ? `${ev.negocios} correos · ${ev.giros} giros` : undefined });
            if (ev.recortado) toast("El archivo es muy grande; se leyó solo la primera parte.", "info");
          } else if (ev.tipo === "progreso") setLeyendo((l) => ({ ...l, hechos: ev.hechos, total: ev.total, fase: "Leyendo y clasificando…" }));
          else if (ev.tipo === "pensando") setLeyendo((l) => (l ? { ...l, fase: "Pensando ideas de proyecto…" } : l));
          else if (ev.tipo === "registros") registros = ev.registros;
          else if (ev.tipo === "ideas") ideas = ev.ideas;
          else if (ev.tipo === "aviso") toast(ev.mensaje, "error");
          else if (ev.tipo === "error") throw new Error(ev.error);
        }
      }
      setEstado(() => ({ registros, ideas, asignado: Object.fromEntries(registros.map((r) => [r.correo, r.proyecto])), agregados: [] }));
      if (!registros.length) toast("No se encontraron correos en los datos.", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLeyendo(null);
    }
  };

  const crear = async (k: number) => {
    const idea = estado?.ideas[k];
    if (!idea) return;
    setEstado((e) => ({ ...e, ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: true } : x)) }));
    const r = await crearProyectoDesdeIdea(idea.idea);
    if (!r?.ok || !r.slug) {
      toast(r?.error ?? "No se pudo crear.", "error");
      setEstado((e) => ({ ...e, ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: false } : x)) }));
      return;
    }
    setProyectos((p) => [...p, { slug: r.slug!, nombre: r.nombre ?? idea.titulo, icono: r.icono ?? null, color: r.color ?? null }]);
    setEstado((e) => ({
      ...e,
      ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: false, slug: r.slug } : x)),
      // Los correos de la idea pasan al proyecto nuevo (si nadie los cambió a mano).
      asignado: { ...e.asignado, ...Object.fromEntries(idea.correos.filter((c) => e.asignado[c] === "ninguno").map((c) => [c, r.slug!])) },
    }));
    toast(r.message ?? "Proyecto creado.", "ok", { href: `/proyectos/${r.slug}`, label: "Ver proyecto" });
  };

  const registros = useMemo(() => estado?.registros ?? [], [estado]);
  const asignado = estado?.asignado ?? {};
  const agregados = new Set(estado?.agregados ?? []);
  const slugs = new Set(proyectos.map((p) => p.slug));
  const deProyecto = (c: string) => (slugs.has(asignado[c]) ? asignado[c] : null);
  const pasa = (r: Registro, f: Filtro) => {
    const a = asignado[r.correo];
    if (f === "rubro") return a === "mismo_rubro";
    if (a === "mismo_rubro") return false; // se apartan de las demás vistas
    return f === "con" ? !!deProyecto(r.correo) : f === "sin" ? a === "ninguno" : f === "sin_info" ? a === "sin_info" : f === "existentes" ? r.ya_existe : true;
  };
  const visibles = registros.filter((r) => pasa(r, filtro));
  const elegibles = visibles.filter((r) => !r.rebote && !agregados.has(r.correo));

  const agregar = () =>
    startGuardar(async () => {
      const filas = registros
        .filter((r) => sel.has(r.correo))
        .map((r) => ({ correo: r.correo, negocio: r.negocio || r.correo.split("@")[1], sitio: r.sitio, ciudad: r.ciudad, estado: r.estado, telefono: r.telefono, descripcion: r.descripcion, proyecto: deProyecto(r.correo), segmento: deProyecto(r.correo) === r.proyecto ? r.segmento : "" }));
      const res = await importarCarga(filas);
      if (res?.message) toast(res.message, "ok", { href: "/directorio", label: "Ver directorio" });
      if (res?.error) toast(res.error, "error");
      if (res?.ok) {
        setEstado((e) => ({ ...e, agregados: [...e.agregados, ...filas.map((f) => f.correo)] }));
        setSel(new Set());
      }
    });

  if (leyendo)
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <LoaderCircle size={28} className="mx-auto mb-4 animate-spin text-accent" />
        <p className="font-medium">{leyendo.fase}</p>
        {leyendo.total > 0 && (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f1efe8]"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((leyendo.hechos / leyendo.total) * 100)}%` }} /></div>
            <p className="mt-2 text-xs text-ink-3">{leyendo.detalle ?? `${leyendo.hechos} de ${leyendo.total} partes`}</p>
          </>
        )}
      </div>
    );

  if (!estado || !registros.length)
    return (
      <div className="max-w-3xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); void agregarArchivos(e.dataTransfer.files); }}
          className={`card p-5 transition-colors ${arrastrando ? "border-accent bg-accent-soft/30" : ""}`}
        >
          <textarea
            className="textarea min-h-56 w-full font-mono text-[13px]"
            placeholder="Pega aquí correos, una lista, un CSV o un JSON… o arrastra archivos"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={input} type="file" multiple accept=".json,.csv,.txt,.tsv,application/json,text/*" className="hidden" onChange={(e) => e.target.files && void agregarArchivos(e.target.files)} />
            <button type="button" className="btn" onClick={() => input.current?.click()}><FileUp size={15} /> Elegir archivos</button>
            {archivos.map((a) => <span key={a} className="rounded-full bg-[#efede5] px-2 py-0.5 text-xs text-ink-2">{a}</span>)}
            <span className="ml-auto flex gap-2">
              {texto && <button type="button" className="btn btn-quiet" onClick={() => { setTexto(""); setArchivos([]); }}>Limpiar</button>}
              <button type="button" className="btn btn-primary" disabled={texto.trim().length < 5} onClick={leerDatos}><Sparkles size={15} /> Leer y clasificar</button>
            </span>
          </div>
        </div>
      </div>
    );

  const cuenta = (f: Filtro) => registros.filter((r) => pasa(r, f)).length;
  const conProyecto = registros.filter((r) => sel.has(r.correo) && deProyecto(r.correo)).length;

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">{registros.length} correos</p>
        <button type="button" className="btn btn-quiet" onClick={() => { setEstadoRaw(null); try { sessionStorage.removeItem(GUARDADO); } catch {} }}>
          <Plus size={15} /> Nueva carga
        </button>
      </div>

      {estado.ideas.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {estado.ideas.map((i, k) => (
            <div key={k} className="card flex flex-col p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-ink-3"><Sparkles size={13} className="text-accent" /> Idea para proyecto · {i.correos.length} correos</div>
              <b className="font-medium">{i.titulo}</b>
              <p className="mt-1 line-clamp-3 text-sm text-ink-2">{i.idea}</p>
              <div className="mt-3 flex items-center justify-end">
                {i.slug ? (
                  <Link href={`/proyectos/${i.slug}`} className="btn btn-sm">Creado · ver</Link>
                ) : (
                  <button type="button" className="btn btn-sm btn-primary" disabled={i.creando} onClick={() => crear(k)}>
                    {i.creando ? <><LoaderCircle size={13} className="animate-spin" /> Creando… (1 min)</> : "Crear"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([["todos", "Todos"], ["con", "Con proyecto"], ["sin", "Sin proyecto"], ["sin_info", "Sin info suficiente"], ["existentes", "Ya en directorio"], ["rubro", "Mismo rubro"]] as [Filtro, string][]).map(([k, l]) => (
          <button key={k} type="button" className={pillCls(filtro === k)} onClick={() => { setFiltro(k); setLimite(POR_PAGINA); }}>{l} <span className="text-ink-3">{cuenta(k)}</span></button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.25rem_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-3 border-b border-line bg-[#faf9f5] px-4 py-2.5 text-xs font-medium text-ink-3 md:grid">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            aria-label="Seleccionar todos los visibles"
            checked={elegibles.length > 0 && elegibles.every((r) => sel.has(r.correo))}
            onChange={(e) => setSel((s) => { const n = new Set(s); for (const r of elegibles) if (e.target.checked) n.add(r.correo); else n.delete(r.correo); return n; })}
          />
          <span>Correo</span>
          <span>Negocio</span>
          <span>Proyecto</span>
        </div>
        <ul className="divide-y divide-line">
          {visibles.slice(0, limite).map((r) => {
            const hecho = agregados.has(r.correo);
            const bloqueado = r.rebote || hecho;
            return (
              <li key={r.correo} className={`grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[1.25rem_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:items-center ${bloqueado ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)] md:mt-0"
                  disabled={bloqueado}
                  checked={sel.has(r.correo)}
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.correo)) n.delete(r.correo); else n.add(r.correo); return n; })}
                  aria-label={`Seleccionar ${r.correo}`}
                />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[13px]">{r.correo}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {hecho && <span className="rounded-full bg-ok-soft px-1.5 text-[11px] text-ok">Agregado</span>}
                    {r.rebote && <span className="rounded-full bg-bad-soft px-1.5 text-[11px] text-bad">Rebotó</span>}
                    {r.ya_existe && !r.rebote && <span className="rounded-full bg-[#efede5] px-1.5 text-[11px] text-ink-2">Ya en directorio</span>}
                  </span>
                </span>
                <span className="col-start-2 min-w-0 md:col-start-auto">
                  <span className="block truncate">{r.negocio || "—"}</span>
                  <span className="block truncate text-xs text-ink-3" title={r.descripcion}>{[r.descripcion, [r.ciudad, r.estado].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="col-start-2 flex min-w-0 items-center gap-2 md:col-start-auto">
                  {deProyecto(r.correo) && (() => { const p = proyectos.find((x) => x.slug === deProyecto(r.correo))!; return <ProjectIcon nombre={p.nombre} icono={p.icono} color={p.color} size={18} />; })()}
                  <select
                    className="select select-sm min-w-0 flex-1"
                    value={asignado[r.correo] ?? "ninguno"}
                    disabled={hecho}
                    onChange={(e) => setEstado((s) => ({ ...s, asignado: { ...s.asignado, [r.correo]: e.target.value } }))}
                    title={r.razon}
                    aria-label={`Proyecto de ${r.correo}`}
                  >
                    {proyectos.map((p) => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
                    <option value="ninguno">Sin proyecto</option>
                    <option value="sin_info">Sin info suficiente</option>
                    <option value="mismo_rubro">Mismo rubro</option>
                  </select>
                </span>
              </li>
            );
          })}
        </ul>
        {visibles.length > limite && (
          <button type="button" className="block w-full border-t border-line py-2.5 text-sm text-ink-2 hover:bg-[#faf9f5]" onClick={() => setLimite((l) => l + POR_PAGINA)}>
            Mostrar más <span className="text-ink-3">{visibles.length - limite}</span>
          </button>
        )}
      </div>

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:pl-60">
          <div className="card flex items-center gap-3 px-4 py-3 shadow-lg">
            <span className="text-sm">{sel.size} seleccionado(s){conProyecto ? ` · ${conProyecto} irán a prospectos` : ""}</span>
            <button type="button" className="btn btn-quiet btn-icon" onClick={() => setSel(new Set())} aria-label="Quitar selección"><X size={15} /></button>
            <button type="button" className="btn btn-primary" disabled={guardando} onClick={agregar}>
              {guardando ? "Guardando…" : "Agregar al directorio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
