"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarProject } from "@/lib/queries";

/* Iconos de línea, 18px */
const I = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICON = {
  resumen: <I d={<><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>} />,
  buscar: <I d={<><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" /></>} />,
  prospectos: <I d={<><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16.5c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" /><path d="M13.2 4.6a2.6 2.6 0 0 1 0 4.8M14.8 12.4c1.3.5 2.3 1.8 2.7 4" /></>} />,
  borradores: <I d={<><path d="M4 15.5V16h.5l9-9-.5-.5-9 9z" /><path d="M12.5 5.5l2 2 1.3-1.3a1.4 1.4 0 0 0-2-2z" /><path d="M3 17.5h14" /></>} />,
  respuestas: <I d={<><path d="M3 11l2.2-6.2A1.5 1.5 0 0 1 6.6 4h6.8a1.5 1.5 0 0 1 1.4.8L17 11v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15z" /><path d="M3 11h4l1 2h4l1-2h4" /></>} />,
  config: <I d={<><path d="M4 5h8M15 5h1M4 10h2M9 10h7M4 15h6M13 15h3" /><circle cx="13.5" cy="5" r="1.5" /><circle cx="7.5" cy="10" r="1.5" /><circle cx="11.5" cy="15" r="1.5" /></>} />,
  inicio: <I d={<><path d="M3.5 9L10 3.5 16.5 9" /><path d="M5 8v8.5h10V8" /></>} />,
  ajustes: <I d={<><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>} />,
  mas: <I d={<path d="M10 4.5v11M4.5 10h11" />} />,
  menu: <I d={<path d="M3.5 6h13M3.5 10h13M3.5 14h13" />} />,
  chevron: (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
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
  const slugActual = fromPath && fromPath !== "nuevo" ? decodeURIComponent(fromPath) : last;
  const actual = projects.find((p) => p.slug === slugActual) ?? projects[0];

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

  const contenido = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/" onClick={cerrar} className="px-3 font-serif text-2xl tracking-tight text-ink">
        Prospector
      </Link>

      {actual ? (
        <div ref={pickerRef} className="relative">
          <span className="mb-1 block px-3 text-[11px] font-medium uppercase tracking-wider text-ink-3">Proyecto</span>
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            aria-expanded={picker}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-line-strong"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft font-serif text-sm text-accent">{actual.nombre.slice(0, 1)}</span>
            <span className="flex-1 truncate font-medium">{actual.nombre}</span>
            <span className="text-ink-3">{ICON.chevron}</span>
          </button>
          {picker && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
              {projects.map((p) => (
                <Link
                  key={p.slug}
                  href={`/proyectos/${p.slug}`}
                  onClick={() => { setPicker(false); cerrar(); }}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-[#f3f1ea] ${p.slug === actual.slug ? "font-medium" : ""}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent-soft font-serif text-xs text-accent">{p.nombre.slice(0, 1)}</span>
                  <span className="flex-1 truncate">{p.nombre}</span>
                  {p.buscando > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" title="Buscando" />}
                  {p.slug === actual.slug && <span className="text-accent">✓</span>}
                </Link>
              ))}
              <div className="my-1 border-t border-line" />
              <Link href="/proyectos/nuevo" onClick={() => { setPicker(false); cerrar(); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-[#f3f1ea]">
                {ICON.mas} Nuevo proyecto
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
          <Item href={`${base}/prospectos`} icon={ICON.prospectos} label="Prospectos" active={starts(`${base}/prospectos`)} count={actual.pendientes} onNavigate={cerrar} />
          <Item href={`${base}/borradores`} icon={ICON.borradores} label="Borradores" active={starts(`${base}/borradores`)} count={actual.borradores} tone="accent" onNavigate={cerrar} />
          <Item href={`${base}/respuestas`} icon={ICON.respuestas} label="Respuestas" active={starts(`${base}/respuestas`)} count={actual.respuestas} tone="accent" onNavigate={cerrar} />
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
        <button type="button" className="btn btn-quiet px-2" aria-label="Abrir menú" onClick={() => setOpen(true)}>
          {ICON.menu}
        </button>
        <Link href="/" className="font-serif text-xl tracking-tight">Prospector</Link>
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
