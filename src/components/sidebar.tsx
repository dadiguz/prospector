"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarProject } from "@/lib/queries";
import { ProjectIcon } from "@/lib/project-icons";
import { AppLogo } from "./logo";
import { ChevronDown, House, Inbox, LayoutGrid, Menu, Plus, Search, Settings, SlidersHorizontal, SquarePen, Users, Check } from "lucide-react";

/* Iconos de línea al estilo de los símbolos del sistema. */
const ic = { size: 18, strokeWidth: 1.6, "aria-hidden": true } as const;
const ICON = {
  resumen: <LayoutGrid {...ic} />,
  buscar: <Search {...ic} />,
  prospectos: <Users {...ic} />,
  borradores: <SquarePen {...ic} />,
  respuestas: <Inbox {...ic} />,
  config: <SlidersHorizontal {...ic} />,
  inicio: <House {...ic} />,
  ajustes: <Settings {...ic} />,
  mas: <Plus {...ic} />,
  menu: <Menu {...ic} />,
  chevron: <ChevronDown size={14} strokeWidth={1.8} aria-hidden />,
};

const LAST = "ultimo-proyecto";
const readLast = () => {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
};
const subscribeLast = (cb: () => void) => {
  window.addEventListener("ultimo-proyecto", cb);
  return () => window.removeEventListener("ultimo-proyecto", cb);
};
const writeLast = (slug: string) => {
  try {
    if (localStorage.getItem(LAST) === slug) return;
    localStorage.setItem(LAST, slug);
    window.dispatchEvent(new Event("ultimo-proyecto"));
  } catch {
    /* sin almacenamiento */
  }
};

function Item({ href, icon, label, active, count, tone, onNavigate }: { href: string; icon: ReactNode; label: string; active: boolean; count?: number; tone?: "accent"; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-[#efede5] hover:text-ink"}`}
    >
      <span className={active ? "text-accent" : "text-ink-3"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count ? (
        <span className={`rounded-full px-1.5 text-xs ${tone === "accent" ? "bg-accent text-white" : "bg-[#e9e6dc] text-ink-2"}`}>{count}</span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // cajón en pantallas angostas
  const [picker, setPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fromPath = pathname.match(/^\/proyectos\/([^/]+)/)?.[1];
  // Último proyecto abierto: así Ajustes o Inicio siguen mostrando el menú de ese proyecto.
  const last = useSyncExternalStore(subscribeLast, readLast, () => null);
  const nuevo = fromPath === "nuevo";
  const slugActual = fromPath && !nuevo ? decodeURIComponent(fromPath) : last;
  // En "Nuevo proyecto" no hay proyecto seleccionado.
  const actual = nuevo ? undefined : (projects.find((p) => p.slug === slugActual) ?? projects[0]);

  useEffect(() => {
    if (fromPath && fromPath !== "nuevo") writeLast(decodeURIComponent(fromPath));
  }, [fromPath]);

  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent) => !pickerRef.current?.contains(e.target as Node) && setPicker(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picker]);

  const cerrar = () => setOpen(false);
  const base = actual ? `/proyectos/${actual.slug}` : "";
  const is = (p: string) => pathname === p;
  const starts = (p: string) => pathname.startsWith(p);

  // Secciones visitadas desde que llegaron estos conteos: su contador ya no se muestra
  // (el servidor los pone en cero en el siguiente refresco). Se reinicia cuando llegan conteos nuevos.
  const seccionActual = pathname.match(/^\/proyectos\/[^/]+\/(prospectos|borradores|respuestas)/)?.[1];
  const [vistas, setVistas] = useState<{ datos: SidebarProject[]; claves: string[] }>({ datos: projects, claves: [] });
  const clave = seccionActual && actual ? `${actual.slug}:${seccionActual}` : null;
  if (vistas.datos !== projects) setVistas({ datos: projects, claves: clave ? [clave] : [] });
  else if (clave && !vistas.claves.includes(clave)) setVistas({ datos: projects, claves: [...vistas.claves, clave] });
  const conteo = (sec: string, n: number) => (actual && vistas.claves.includes(`${actual.slug}:${sec}`) ? undefined : n);

  const contenido = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/" onClick={cerrar} className="flex items-center gap-2.5 px-3 font-serif text-2xl tracking-tight text-ink">
        <AppLogo size={26} />
        Prospector
      </Link>

      {projects.length > 0 ? (
        <div ref={pickerRef} className="relative">
          <span className="mb-1 block px-3 text-[11px] font-medium uppercase tracking-wider text-ink-3">Proyecto</span>
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            aria-expanded={picker}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-line-strong"
          >
            {actual ? (
              <ProjectIcon nombre={actual.nombre} icono={actual.icono} color={actual.color} size={24} />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-ink-3"><Plus size={14} strokeWidth={1.8} aria-hidden /></span>
            )}
            <span className="flex-1 truncate font-medium">{actual ? actual.nombre : "Nuevo proyecto"}</span>
            <span className="text-ink-3">{ICON.chevron}</span>
          </button>
          {picker && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
              {projects.map((p) => (
                <Link
                  key={p.slug}
                  href={`/proyectos/${p.slug}`}
                  onClick={() => { setPicker(false); cerrar(); }}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-[#f3f1ea] ${p.slug === actual?.slug ? "font-medium" : ""}`}
                >
                  <ProjectIcon nombre={p.nombre} icono={p.icono} color={p.color} size={20} />
                  <span className="flex-1 truncate">{p.nombre}</span>
                  {p.buscando > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" title="Buscando" />}
                  {p.slug === actual?.slug && <Check size={15} strokeWidth={2} className="text-accent" aria-hidden />}
                </Link>
              ))}
              <div className="my-1 border-t border-line" />
              <Link href="/proyectos/nuevo" onClick={() => { setPicker(false); cerrar(); }} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-[#f3f1ea] ${nuevo ? "font-medium text-ink" : "text-ink-2"}`}>
                {ICON.mas} <span className="flex-1">Nuevo proyecto</span>
                {nuevo && <Check size={15} strokeWidth={2} className="text-accent" aria-hidden />}
              </Link>
              <Link href="/#importar" onClick={() => { setPicker(false); cerrar(); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-[#f3f1ea]">
                <span className="w-[18px]" /> Importar .md
              </Link>
            </div>
          )}
        </div>
      ) : (
        <Item href="/proyectos/nuevo" icon={ICON.mas} label="Nuevo proyecto" active={is("/proyectos/nuevo")} onNavigate={cerrar} />
      )}

      {actual && (
        <nav className="space-y-0.5" aria-label={`Secciones de ${actual.nombre}`}>
          <Item href={base} icon={ICON.resumen} label="Resumen" active={is(base)} onNavigate={cerrar} />
          <Item href={`${base}#buscar`} icon={ICON.buscar} label="Buscar prospectos" active={false} count={actual.buscando || undefined} tone="accent" onNavigate={cerrar} />
          <Item href={`${base}/prospectos`} icon={ICON.prospectos} label="Prospectos" active={starts(`${base}/prospectos`)} count={conteo("prospectos", actual.pendientes)} onNavigate={cerrar} />
          <Item href={`${base}/borradores`} icon={ICON.borradores} label="Borradores" active={starts(`${base}/borradores`)} count={conteo("borradores", actual.borradores)} tone="accent" onNavigate={cerrar} />
          <Item href={`${base}/respuestas`} icon={ICON.respuestas} label="Respuestas" active={starts(`${base}/respuestas`)} count={conteo("respuestas", actual.respuestas)} tone="accent" onNavigate={cerrar} />
          <Item href={`${base}/editar`} icon={ICON.config} label="Configuración" active={starts(`${base}/editar`)} onNavigate={cerrar} />
        </nav>
      )}

      <nav className="mt-auto space-y-0.5 border-t border-line pt-4" aria-label="General">
        <Item href="/" icon={ICON.inicio} label="Todos los proyectos" active={is("/")} onNavigate={cerrar} />
        <Item href="/ajustes" icon={ICON.ajustes} label="Ajustes" active={starts("/ajustes")} onNavigate={cerrar} />
      </nav>
    </div>
  );

  return (
    <>
      {/* Pantallas anchas: menú fijo */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-line bg-[#f5f3ec] lg:block">{contenido}</aside>

      {/* Pantallas angostas: barra superior y cajón */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" className="btn btn-quiet btn-icon" aria-label="Abrir menú" onClick={() => setOpen(true)}>
          {ICON.menu}
        </button>
        <Link href="/" className="flex items-center gap-2 font-serif text-xl tracking-tight"><AppLogo size={22} />Prospector</Link>
        {actual && <span className="truncate text-sm text-ink-2">· {actual.nombre}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-black/20" aria-label="Cerrar menú" onClick={cerrar} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-[#f5f3ec] shadow-lg">{contenido}</aside>
        </div>
      )}
    </>
  );
}
