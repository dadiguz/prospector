"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Search, Star } from "lucide-react";
import type { DirectorioFila } from "@/lib/queries";
import { ProjectIcon } from "@/lib/project-icons";
import { CopyButton } from "@/components/client";

type Filtro = "todos" | "respondieron" | "enviados" | "sin_enviar";
const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "respondieron", label: "Respondieron" },
  { key: "enviados", label: "Contactados" },
  { key: "sin_enviar", label: "Sin contactar" },
];

const TAMANOS = [25, 50, 100, 200];
const CLAVE_TAMANO = "directorio-por-pagina";
const leerTamano = () => {
  try {
    const n = Number(localStorage.getItem(CLAVE_TAMANO));
    return TAMANOS.includes(n) ? n : null;
  } catch {
    return null;
  }
};
const sinSuscripcion = () => () => {};

const corto = (s?: string, n = 140) => (s && s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s ?? "");
const industria = (f: DirectorioFila) => f.proyectos.find((p) => p.segmento)?.segmento ?? corto(f.ficha.tipo?.split(/[,;(]/)[0], 60) ?? "";
const pillCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`;

function csv(filas: DirectorioFila[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lineas = [["correo", "negocio", "industria", "proyectos", "respondio", "ciudad", "estado", "sitio"].join(",")];
  for (const f of filas)
    lineas.push([f.correo, f.negocio, industria(f), f.proyectos.map((p) => p.nombre).join(" | "), f.respondio ? "sí" : "no", f.ciudad ?? "", f.estado_mx ?? "", f.ficha.sitio_web ?? ""].map((x) => q(String(x))).join(","));
  const url = URL.createObjectURL(new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "directorio.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** Tabla del directorio: un correo por fila; al dar clic se ve de qué negocio es y de dónde salió. */
export function DirectoryTable({ filas }: { filas: DirectorioFila[] }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [proyecto, setProyecto] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const marcar = (c: string) => setMarcados((m) => { const n = new Set(m); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  // El tamaño de página se recuerda en este navegador; 50 si no se ha elegido.
  const guardado = useSyncExternalStore(sinSuscripcion, leerTamano, () => null);
  const [elegido, setPorPagina] = useState<number | null>(null);
  const porPagina = elegido ?? guardado ?? 50;
  const [pagina, setPagina] = useState(0);

  const proyectos = useMemo(() => {
    const m = new Map<string, DirectorioFila["proyectos"][number]>();
    for (const f of filas) for (const p of f.proyectos) if (!m.has(p.slug)) m.set(p.slug, p);
    return [...m.values()];
  }, [filas]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return filas.filter((f) => {
      if (filtro === "respondieron" && !f.respondio) return false;
      if (filtro === "enviados" && !f.enviados) return false;
      if (filtro === "sin_enviar" && f.enviados) return false;
      if (proyecto && !f.proyectos.some((p) => p.slug === proyecto)) return false;
      if (!t) return true;
      return [f.correo, f.negocio, industria(f), f.ciudad ?? "", f.estado_mx ?? "", ...f.proyectos.map((p) => p.nombre)]
        .join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t);
    });
  }, [filas, q, filtro, proyecto]);

  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);
  const enPagina = visibles.slice(actual * porPagina, (actual + 1) * porPagina);
  // Al cambiar búsqueda o filtros se vuelve a la primera página.
  const [claveFiltros, setClaveFiltros] = useState(`${q}|${filtro}|${proyecto}`);
  if (claveFiltros !== `${q}|${filtro}|${proyecto}`) {
    setClaveFiltros(`${q}|${filtro}|${proyecto}`);
    setPagina(0);
  }

  const cuenta = (k: Filtro) =>
    filas.filter((f) => (k === "respondieron" ? f.respondio : k === "enviados" ? f.enviados : k === "sin_enviar" ? !f.enviados : true) && (!proyecto || f.proyectos.some((p) => p.slug === proyecto))).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="input w-full" style={{ paddingLeft: "2.1rem" }} placeholder="Buscar correo, negocio, industria o ciudad" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el directorio" />
        </label>
        <select className="select" style={{ width: "auto", minWidth: "12rem" }} value={proyecto} onChange={(e) => setProyecto(e.target.value)} aria-label="Filtrar por proyecto">
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => csv(marcados.size ? filas.filter((f) => marcados.has(f.correo)) : visibles)}>
          <Download size={15} /> {marcados.size ? `CSV (${marcados.size})` : "CSV"}
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button key={f.key} type="button" className={pillCls(filtro === f.key)} onClick={() => setFiltro(f.key)}>
            {f.label} <span className="text-ink-3">{cuenta(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.25rem_1.5rem_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_1.25rem] gap-3 border-b border-line bg-[#faf9f5] px-4 py-2.5 text-xs font-medium text-ink-3 md:grid">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            aria-label="Seleccionar todos los visibles"
            checked={enPagina.length > 0 && enPagina.every((f) => marcados.has(f.correo))}
            onChange={(e) => setMarcados((m) => { const n = new Set(m); for (const f of enPagina) if (e.target.checked) n.add(f.correo); else n.delete(f.correo); return n; })}
          />
          <span className="flex justify-center" title="Respondió"><Star size={13} className="fill-[#d4a564] text-[#d4a564]" aria-label="Respondió" /></span>
          <span>Correo</span>
          <span>Negocio</span>
          <span>Industria</span>
          <span>Proyecto</span>
          <span />
        </div>
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-3">Nada coincide con la búsqueda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {enPagina.map((f) => {
              const open = abierto === f.correo;
              return (
                <li key={f.correo} className="relative">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-[0.95rem] z-10 h-4 w-4 accent-[var(--accent)]"
                    checked={marcados.has(f.correo)}
                    onChange={() => marcar(f.correo)}
                    aria-label={`Seleccionar ${f.correo}`}
                  />
                  <button
                    type="button"
                    onClick={() => setAbierto(open ? null : f.correo)}
                    aria-expanded={open}
                    className="grid w-full grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_1.25rem] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left text-sm hover:bg-[#fcfbf8] md:grid-cols-[1.25rem_1.5rem_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_1.25rem]"
                  >
                    <span className="row-span-3 md:row-span-1" aria-hidden />
                    <span className="row-span-3 flex justify-center md:row-span-1">
                      {f.respondio ? <Star size={15} className="fill-[#d4a564] text-[#d4a564]" aria-label="Respondió" /> : null}
                    </span>
                    <span className="truncate font-mono text-[13px]">{f.correo}</span>
                    <span className="hidden truncate md:block">{f.negocio}</span>
                    <span className="hidden truncate text-ink-2 md:block">{industria(f)}</span>
                    <span className="hidden min-w-0 items-center gap-1.5 md:flex">
                      {f.proyectos.slice(0, 2).map((p) => (
                        <span key={p.slug} className="flex min-w-0 items-center gap-1.5 text-ink-2" title={p.nombre}>
                          <ProjectIcon nombre={p.nombre} icono={p.icono} color={p.color} size={18} />
                          {f.proyectos.length === 1 && <span className="truncate">{p.nombre}</span>}
                        </span>
                      ))}
                    </span>
                    <ChevronRight size={15} className={`row-span-3 text-ink-3 transition-transform md:row-span-1 ${open ? "rotate-90" : ""}`} aria-hidden />
                    <span className="truncate text-xs text-ink-2 md:hidden">{f.negocio}</span>
                    <span className="truncate text-xs text-ink-3 md:hidden">{[industria(f), f.proyectos.map((p) => p.nombre).join(", ")].filter(Boolean).join(" · ")}</span>
                  </button>
                  {open && <Detalle f={f} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {visibles.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
          <label className="flex items-center gap-2">
            Mostrar
            <select
              className="select select-sm"
              style={{ width: "auto" }}
              value={porPagina}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPorPagina(n);
                setPagina(0);
                try {
                  localStorage.setItem(CLAVE_TAMANO, String(n));
                } catch {
                  /* sin almacenamiento */
                }
              }}
              aria-label="Correos por página"
            >
              {TAMANOS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            por página
          </label>
          <div className="flex items-center gap-2">
            <span>
              {actual * porPagina + 1}–{Math.min((actual + 1) * porPagina, visibles.length)} de {visibles.length}
            </span>
            <button type="button" className="btn btn-sm btn-icon" disabled={actual === 0} onClick={() => setPagina(actual - 1)} aria-label="Página anterior">
              <ChevronLeft size={15} />
            </button>
            <button type="button" className="btn btn-sm btn-icon" disabled={actual >= paginas - 1} onClick={() => setPagina(actual + 1)} aria-label="Página siguiente">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detalle({ f }: { f: DirectorioFila }) {
  const sitio = f.ficha.sitio_web;
  const fuente = f.ficha.fuente_del_correo;
  const filas: [string, string | undefined][] = [
    ["Qué es", f.ficha.tipo],
    ["Dónde", [f.ciudad, f.estado_mx].filter(Boolean).join(", ") || undefined],
    ["Cómo cobra hoy", corto(f.ficha.vende ?? f.ficha.como_cobra_hoy, 260) || undefined],
    ["Observación", corto(f.ficha.vimos ?? f.ficha.observacion, 260) || undefined],
  ];
  return (
    <div className="border-t border-line bg-[#fcfbf8] px-4 py-4 text-sm sm:pl-[3.75rem]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-base font-medium">{f.negocio}</span>
        {f.respondio ? <span className="rounded-full bg-[#f5ecd3] px-2 py-0.5 text-xs font-medium text-[#85631d]">Respondió{f.ultima_respuesta ? ` · ${new Date(f.ultima_respuesta + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</span> : null}
        {f.enviados ? <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">Contactado{f.enviados > 1 ? ` · ${f.enviados} correos` : ""}</span> : <span className="rounded-full bg-[#efede5] px-2 py-0.5 text-xs text-ink-2">Sin contactar</span>}
        {f.baja ? <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">Pidió no ser contactado</span> : null}
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_1fr]">
        {filas.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {sitio && (
          <div className="contents">
            <dt className="text-ink-3">Sitio</dt>
            <dd><a href={sitio} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-4">{sitio.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}<ExternalLink size={12} aria-hidden /></a></dd>
          </div>
        )}
        {fuente && (
          <div className="contents">
            <dt className="text-ink-3">De dónde salió el correo</dt>
            <dd className="break-all"><a href={fuente} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">{fuente.replace(/^https?:\/\/(www\.)?/, "")}</a></dd>
          </div>
        )}
        <div className="contents">
          <dt className="text-ink-3">Proyectos</dt>
          <dd className="flex flex-col gap-1.5">
            {f.proyectos.map((p) => (
              <Link key={p.slug} href={`/proyectos/${p.slug}/prospectos?lista=${p.lista === "descartado" ? "descartado" : "todos"}&todos=1`} className="flex items-center gap-2 hover:underline">
                <ProjectIcon nombre={p.nombre} icono={p.icono} color={p.color} size={18} />
                <span>{p.nombre}</span>
                {p.segmento && <span className="text-ink-3">· {p.segmento}</span>}
                {p.lista === "descartado" && <span className="text-xs text-ink-3">(descartado)</span>}
              </Link>
            ))}
          </dd>
        </div>
      </dl>
      <div className="mt-3"><CopyButton text={f.correo} label="Copiar correo" className="btn btn-sm" /></div>
    </div>
  );
}
