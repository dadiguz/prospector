"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileUp, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { coincide } from "@/lib/text";
import { crearProyectoDesdeIdea, crearSegmentoDesdeIdea, guardarCambiosCarga, importarCarga, repensarIdeas } from "@/app/actions";
import type { IdeaProyecto, Registro } from "@/lib/carga";
import { ProjectIcon } from "@/lib/project-icons";
import { toast } from "@/components/toaster";

export type ProyectoOpcion = { slug: string; nombre: string; icono: string | null; color: string | null };
type Idea = IdeaProyecto & { creando?: boolean; slug?: string; segmento?: string };
type Filtro = "todos" | "con" | "sin" | "sin_info" | "rubro" | "existentes";
const POR_PAGINA = 100;

const pillCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`;

export type Estado = { registros: Registro[]; ideas: Idea[]; asignado: Record<string, string>; agregados: string[]; segmentos?: Record<string, string> };
export type CargaInfo = { id: number; titulo: string; fecha: string; archivos: string };

export function Cargar({ proyectos: inicial, carga, estadoInicial, agente }: { proyectos: ProyectoOpcion[]; carga?: CargaInfo; estadoInicial?: Estado; agente?: ReactNode }) {
  const router = useRouter();
  const [proyectos, setProyectos] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [archivos, setArchivos] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState<{ hechos: number; total: number; fase: string; detalle?: string } | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [estado, setEstadoRaw] = useState<Estado | null>(estadoInicial ?? null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [guardando, startGuardar] = useTransition();
  const [repensando, startRepensar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const setEstado = (f: (e: Estado) => Estado) => setEstadoRaw((prev) => f(prev ?? { registros: [], ideas: [], asignado: {}, agregados: [] }));

  // Cada cambio queda guardado en la carga (con una pausa corta para juntar varios).
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (!carga || !estado) return;
    const t = setTimeout(() => {
      void guardarCambiosCarga(carga.id, {
        ideas: estado.ideas.map((i) => ({ ...i, creando: undefined })),
        asignado: estado.asignado,
        agregados: estado.agregados,
        segmentos: estado.segmentos ?? {},
      }).then((r) => r?.error && toast(r.error, "error"));
    }, 600);
    return () => clearTimeout(t);
  }, [estado, carga]);

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
      const res = await fetch("/api/directorio/cargar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, titulo: titulo.trim() || undefined, archivos }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo leer.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let destino: number | null = null;
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
          else if (ev.tipo === "pensando") setLeyendo((l) => (l ? { ...l, fase: "Pensando ideas y título…" } : l));
          else if (ev.tipo === "guardado") destino = ev.id;
          else if (ev.tipo === "vacio") toast("No se encontraron correos en los datos.", "info");
          else if (ev.tipo === "aviso") toast(ev.mensaje, "error");
          else if (ev.tipo === "error") throw new Error(ev.error);
        }
      }
      if (destino) return router.push(`/directorio/cargar/${destino}`);
      setLeyendo(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
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

  const comoSegmento = async (k: number) => {
    const idea = estado?.ideas[k];
    if (!idea?.proyecto) return;
    const slug = idea.proyecto;
    setEstado((e) => ({ ...e, ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: true } : x)) }));
    const r = await crearSegmentoDesdeIdea(slug, idea.titulo, idea.idea);
    if (!r?.ok || !r.segmento) {
      toast(r?.error ?? "No se pudo agregar.", "error");
      setEstado((e) => ({ ...e, ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: false } : x)) }));
      return;
    }
    const seg = r.segmento;
    setEstado((e) => {
      const mios = idea.correos.filter((c) => e.asignado[c] === "ninguno");
      return {
        ...e,
        ideas: e.ideas.map((x, j) => (j === k ? { ...x, creando: false, slug, segmento: seg } : x)),
        asignado: { ...e.asignado, ...Object.fromEntries(mios.map((c) => [c, slug])) },
        segmentos: { ...e.segmentos, ...Object.fromEntries(mios.map((c) => [c, seg])) },
      };
    });
    toast(r.message ?? "Segmento agregado.", "ok", { href: `/proyectos/${slug}/editar`, label: "Ver proyecto" });
  };

  const repensar = () =>
    startRepensar(async () => {
      const e = estado;
      if (!e) return;
      const filas = e.registros
        .filter((r) => e.asignado[r.correo] === "ninguno" && !r.rebote && !e.agregados.includes(r.correo))
        .map((r) => ({ correo: r.correo, negocio: r.negocio, giro: r.giro, descripcion: r.descripcion, idea: r.idea }));
      const res = await repensarIdeas(filas);
      if (res?.error) return void toast(res.error, "error");
      // Las ideas ya creadas o agregadas se quedan; las demás se reemplazan.
      setEstado((s) => ({ ...s, ideas: [...s.ideas.filter((i) => i.slug), ...(res?.ideas ?? [])] }));
    });

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
  const visibles = registros.filter((r) => pasa(r, filtro) && coincide(q, r.correo, r.negocio, r.descripcion, r.ciudad, r.estado));
  const elegibles = visibles.filter((r) => !r.rebote && !agregados.has(r.correo));

  const agregar = () =>
    startGuardar(async () => {
      const filas = registros
        .filter((r) => sel.has(r.correo))
        .map((r) => ({ correo: r.correo, negocio: r.negocio || r.correo.split("@")[1], sitio: r.sitio, ciudad: r.ciudad, estado: r.estado, telefono: r.telefono, descripcion: r.descripcion, proyecto: deProyecto(r.correo), segmento: (deProyecto(r.correo) && estado?.segmentos?.[r.correo]) || (deProyecto(r.correo) === r.proyecto ? r.segmento : "") }));
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
        <input
          className="input mb-3 w-full"
          placeholder="Título (opcional): INEGI Baja California, Hoteles de Oaxaca…"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
          aria-label="Título de la carga"
        />
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

  const cuenta = (f: Filtro) => registros.filter((r) => pasa(r, f) && coincide(q, r.correo, r.negocio, r.descripcion, r.ciudad, r.estado)).length;
  const conProyecto = registros.filter((r) => sel.has(r.correo) && deProyecto(r.correo)).length;

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link href="/directorio/cargar" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ChevronLeft size={15} /> Cargas</Link>
          {carga && <TituloCarga id={carga.id} inicial={carga.titulo} />}
          <p className="mt-1 text-sm text-ink-3">
            {[carga?.fecha, carga?.archivos, `${registros.length} correos`, estado.agregados.length ? `${estado.agregados.length} agregados` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" className="btn btn-quiet" disabled={repensando} onClick={repensar}>
          {repensando ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Repensar ideas
        </button>
      </div>

      {agente}

      {estado.ideas.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {estado.ideas.map((i, k) => {
            const destino = i.proyecto ? proyectos.find((p) => p.slug === i.proyecto) : undefined;
            return (
              <div key={k} className="card flex flex-col p-4">
                <div className="mb-1 flex items-center gap-2 text-xs text-ink-3">
                  {destino ? <ProjectIcon nombre={destino.nombre} icono={destino.icono} color={destino.color} size={16} /> : <Sparkles size={13} className="text-accent" />}
                  {destino ? `Segmento para ${destino.nombre}` : "Idea para proyecto"} · {i.correos.length} correos
                </div>
                <b className="font-medium">{i.titulo}</b>
                <p className="mt-1 line-clamp-3 text-sm text-ink-2">{i.idea}</p>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {i.slug ? (
                    <Link href={i.segmento ? `/proyectos/${i.slug}/editar` : `/proyectos/${i.slug}`} className="btn btn-sm">{i.segmento ? "Agregado · ver" : "Creado · ver"}</Link>
                  ) : i.creando ? (
                    <button type="button" className="btn btn-sm btn-primary" disabled><LoaderCircle size={13} className="animate-spin" /> {destino ? "Agregando…" : "Creando… (1 min)"}</button>
                  ) : destino ? (
                    <>
                      <button type="button" className="btn btn-sm btn-quiet" onClick={() => crear(k)}>Proyecto nuevo</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => comoSegmento(k)}>Agregar segmento</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => crear(k)}>Crear</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <label className="relative mr-1 block w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            className="input input-sm w-full"
            style={{ paddingLeft: "2.1rem", paddingRight: "2rem" }}
            placeholder="Buscar correo, negocio, giro o ciudad"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimite(POR_PAGINA); }}
            onKeyDown={(e) => e.key === "Escape" && setQ("")}
            aria-label="Buscar"
            type="search"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 flex -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Borrar búsqueda">
              <X size={14} />
            </button>
          )}
        </label>
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

/** Título de la carga; se edita en su lugar y se guarda al salir del campo. */
function TituloCarga({ id, inicial }: { id: number; inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const guardar = async () => {
    const t = valor.trim();
    if (!t || t === guardado) return setValor(guardado);
    const r = await guardarCambiosCarga(id, { titulo: t });
    if (r?.error) { toast(r.error, "error"); setValor(guardado); } else setGuardado(t);
  };
  return (
    <input
      className="-mx-1 w-full rounded-md border border-transparent bg-transparent px-1 font-serif text-4xl leading-tight tracking-tight outline-none hover:border-line focus:border-line-strong focus:bg-surface"
      value={valor}
      maxLength={120}
      onChange={(e) => setValor(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setValor(guardado); setTimeout(() => (e.target as HTMLInputElement).blur()); } }}
      aria-label="Título de la carga"
    />
  );
}
