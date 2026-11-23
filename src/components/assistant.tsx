"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { applyAssistant } from "@/app/actions";
import type { Propuesta, Seccion } from "@/lib/assistant";
import { toast } from "./toaster";
import { ArrowUp, LoaderCircle, Sparkles, X } from "lucide-react";

type Mensaje =
  | { rol: "usuario"; texto: string }
  | { rol: "asistente"; texto: string; propuestas: Propuesta[]; projectId?: number; costo?: number; aplicado?: boolean; error?: boolean };

const SECCIONES: Seccion[] = ["prospectos", "borradores", "respuestas", "editar"];

const SUGERENCIAS: Record<Seccion, string[]> = {
  resumen: ["¿Qué segmento está funcionando mejor?", "Revisa la plantilla y propón una mejor"],
  prospectos: ["Crea borradores para los de la lista A con correo", "Etiqueta como “prioridad” a los 10 con más puntaje"],
  borradores: ["Arregla todas las alertas con la mejor propuesta", "Cambia “Saludos cordiales,” por “Un saludo,” en todos"],
  respuestas: ["¿Quién respondió con interés y qué pide?", "Resume las respuestas negativas y qué aprender"],
  editar: ["¿Qué le falta a este proyecto para buscar mejor?"],
};

function contexto(pathname: string): { slug: string; seccion: Seccion } | null {
  const m = pathname.match(/^\/proyectos\/([^/]+)(?:\/([^/]+))?/);
  if (!m || m[1] === "nuevo") return null;
  const s = m[2] as Seccion | undefined;
  return { slug: m[1], seccion: s && SECCIONES.includes(s) ? s : "resumen" };
}

/** Asistente: un input flotante que conoce el proyecto y la pantalla, y propone cambios que tú apruebas. */
export function Assistant() {
  const pathname = usePathname();
  return pathname === "/proyectos/nuevo" ? <IdeaInput /> : <ProjectAssistant />;
}

/** En "Nuevo proyecto": describe la idea y el editor llena los campos. */
function IdeaInput() {
  const [texto, setTexto] = useState("");
  const [generando, setGenerando] = useState(false);
  useEffect(() => {
    const onEstado = (e: Event) => setGenerando((e as CustomEvent<boolean>).detail);
    window.addEventListener("proyecto:estado", onEstado);
    return () => window.removeEventListener("proyecto:estado", onEstado);
  }, []);
  const enviar = () => {
    const idea = texto.trim();
    if (idea.length < 10 || generando) return;
    window.dispatchEvent(new CustomEvent("proyecto:generar", { detail: idea }));
    setTexto("");
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:left-60 max-xl:pr-44">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col">
        <form
          className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface py-2 pl-4 pr-2 shadow-lg focus-within:border-accent"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <Sparkles size={16} strokeWidth={1.6} className="mb-2 shrink-0 text-accent" aria-hidden />
          <textarea
            rows={1}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={generando ? "Llenando el proyecto…" : "Describe tu idea: qué vendes, a quién y qué quieres lograr"}
            aria-label="Describe tu idea"
            disabled={generando}
            className="max-h-40 min-h-[2rem] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-3"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button type="submit" disabled={generando || texto.trim().length < 10} aria-label="Llenar el proyecto" className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition" style={{ opacity: generando || texto.trim().length < 10 ? 0.35 : 1 }}>
            {generando ? <LoaderCircle size={16} strokeWidth={2} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.2} />}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProjectAssistant() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const ctx = contexto(pathname);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [hilos, setHilos] = useState<Record<string, Mensaje[]>>({});
  const [actividad, setActividad] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const mensajes = ctx ? (hilos[ctx.slug] ?? []) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length, actividad]);

  // Otras pantallas (p. ej. "Problemas" en Borradores) le pasan una petición ya escrita.
  const enviarRef = useRef<(q: string) => void>(() => {});
  useEffect(() => {
    const onPedir = (e: Event) => enviarRef.current((e as CustomEvent<string>).detail);
    window.addEventListener("asistente:pedir", onPedir);
    return () => window.removeEventListener("asistente:pedir", onPedir);
  }, []);

  if (!ctx) return null;
  const { slug, seccion } = ctx;
  const setMensajes = (fn: (m: Mensaje[]) => Mensaje[]) => setHilos((h) => ({ ...h, [slug]: fn(h[slug] ?? []) }));

  enviarRef.current = (q) => void enviar(q);
  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setTexto("");
    setAbierto(true);
    const historial = mensajes.map((m) => ({
      rol: m.rol,
      texto: m.rol === "asistente" && m.propuestas.length ? `${m.texto}\n(Propuestas: ${m.propuestas.map(resumen).join("; ")}${m.aplicado ? " — el usuario las aplicó" : ""})` : m.texto,
    }));
    setMensajes((m) => [...m, { rol: "usuario", texto: q }]);
    setPensando(true);
    setActividad("Pensando…");
    try {
      const tag = Number(sp.get("tag"));
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, seccion, filtros: { lista: sp.get("lista") ?? undefined, tag: tag || undefined }, historial, mensaje: q }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const linea = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!linea.trim()) continue;
          const ev = JSON.parse(linea);
          if (ev.tipo === "actividad") setActividad(ev.texto);
          else if (ev.tipo === "fin") setMensajes((m) => [...m, { rol: "asistente", texto: ev.texto || "Listo.", propuestas: ev.propuestas ?? [], projectId: ev.projectId, costo: ev.costoUsd }]);
          else if (ev.tipo === "error") setMensajes((m) => [...m, { rol: "asistente", texto: ev.error, propuestas: [], error: true }]);
        }
      }
    } catch (e) {
      setMensajes((m) => [...m, { rol: "asistente", texto: e instanceof Error ? e.message : String(e), propuestas: [], error: true }]);
    } finally {
      setPensando(false);
      setActividad(null);
    }
  }

  const marcarAplicado = (idx: number) => setMensajes((ms) => ms.map((m, i) => (i === idx && m.rol === "asistente" ? { ...m, aplicado: true } : m)));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:left-60 max-xl:pr-44">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col">
        {abierto && (mensajes.length > 0 || pensando) && (
          <div className="mb-2 flex max-h-[min(60vh,40rem)] flex-col rounded-2xl border border-line bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-2">
              <span>Asistente · {seccion === "resumen" ? "resumen del proyecto" : seccion}</span>
              <span className="flex gap-3">
                <button type="button" className="hover:text-ink" onClick={() => setMensajes(() => [])} disabled={pensando}>Nueva conversación</button>
                <button type="button" className="hover:text-ink" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={15} strokeWidth={1.8} /></button>
              </span>
            </div>
            <div ref={listaRef} className="space-y-3 overflow-y-auto px-4 py-3 text-sm">
              {mensajes.map((m, i) =>
                m.rol === "usuario" ? (
                  <p key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent-soft px-3 py-2">{m.texto}</p>
                ) : (
                  <div key={i} className="space-y-2">
                    <p className={`whitespace-pre-wrap leading-relaxed ${m.error ? "text-bad" : ""}`}>{conNegritas(m.texto)}</p>
                    {m.propuestas.length > 0 && <Propuestas projectId={m.projectId ?? 0} propuestas={m.propuestas} aplicado={!!m.aplicado} onAplicado={() => marcarAplicado(i)} />}
                    {m.costo != null && <p className="text-[11px] text-ink-3">Costo: ${m.costo.toFixed(3)} USD</p>}
                  </div>
                ),
              )}
              {pensando && (
                <p className="flex items-center gap-2 text-ink-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
                  {actividad}
                </p>
              )}
            </div>
          </div>
        )}

        {abierto && mensajes.length === 0 && !pensando && (
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGERENCIAS[seccion].map((s) => (
              <button key={s} type="button" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 shadow-sm hover:border-accent hover:text-ink" onClick={() => enviar(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface py-2 pl-4 pr-2 shadow-lg focus-within:border-accent"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          <Sparkles size={16} strokeWidth={1.6} className="mb-2 shrink-0 text-accent" aria-hidden />
          <textarea
            ref={inputRef}
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => setAbierto(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            placeholder={pensando ? "Trabajando…" : "Pídele algo al asistente"}
            aria-label="Mensaje para el asistente"
            className="max-h-40 min-h-[2rem] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-3"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <kbd className="mb-2 hidden rounded-md border border-line px-1.5 font-sans text-[11px] text-ink-3 sm:inline">⌘K</kbd>
          <button type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar" className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition" style={{ opacity: pensando || !texto.trim() ? 0.35 : 1 }}>
            {pensando ? <LoaderCircle size={16} strokeWidth={2} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.2} />}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Solo **negritas** y `código`: lo demás se muestra tal cual. */
function conNegritas(t: string): React.ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((x, i) =>
    x.startsWith("**") ? <strong key={i} className="font-medium">{x.slice(2, -2)}</strong>
    : x.startsWith("`") ? <code key={i} className="rounded bg-[#f1efe8] px-1 text-[12px]">{x.slice(1, -1)}</code>
    : x,
  );
}

function resumen(p: Propuesta): string {
  switch (p.tipo) {
    case "editar_borrador": return `editar borrador de ${p.nombre}`;
    case "editar_plantilla": return `editar plantilla ${p.clave}`;
    case "crear_borradores": return `crear ${p.prospectIds.length} borrador(es)`;
    case "descartar_borradores": return `descartar ${p.ids.length} borrador(es)`;
    case "etiquetar": return `etiquetar ${p.prospectIds.length} con “${p.etiqueta}”`;
  }
}

/** Tarjeta con las propuestas: se eligen, se revisan y se aplican. */
function Propuestas({ propuestas, aplicado, onAplicado, projectId }: { propuestas: Propuesta[]; aplicado: boolean; onAplicado: () => void; projectId: number }) {
  const [sel, setSel] = useState<string[]>(() => propuestas.map((p) => p.key));
  const [pending, start] = useTransition();
  const aplicar = () =>
    start(async () => {
      const elegidas = propuestas.filter((p) => sel.includes(p.key));
      const r = await applyAssistant(projectId, elegidas);
      if (r?.error && !r.ok) return toast(r.error, "error");
      toast(r?.message ?? "Aplicado.");
      if (r?.error) toast(r.error, "info");
      onAplicado();
    });

  return (
    <div className="rounded-xl border border-line bg-bg">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs text-ink-2">
        <span>{propuestas.length} propuesta(s){aplicado ? " · aplicadas" : ""}</span>
        {!aplicado && propuestas.length > 1 && (
          <button type="button" className="hover:text-ink" onClick={() => setSel(sel.length ? [] : propuestas.map((p) => p.key))}>
            {sel.length ? "Quitar todas" : "Elegir todas"}
          </button>
        )}
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {propuestas.map((p) => (
          <Item key={p.key} p={p} disabled={aplicado} checked={sel.includes(p.key)} onToggle={() => setSel((s) => (s.includes(p.key) ? s.filter((k) => k !== p.key) : [...s, p.key]))} />
        ))}
      </ul>
      {!aplicado && (
        <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
          <span className="mr-auto" />
          <button type="button" onClick={aplicar} disabled={pending || !sel.length} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white" style={{ opacity: pending || !sel.length ? 0.4 : 1 }}>
            {pending ? "Aplicando…" : `Aplicar ${sel.length}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Item({ p, checked, onToggle, disabled }: { p: Propuesta; checked: boolean; onToggle: () => void; disabled: boolean }) {
  const [ver, setVer] = useState(false);
  const [antes, setAntes] = useState(false);
  let titulo: React.ReactNode;
  let detalle: React.ReactNode = null;
  if (p.tipo === "editar_borrador") {
    const delta = p.antes.errores || p.despues.errores ? `errores ${p.antes.errores} → ${p.despues.errores}` : p.antes.avisos !== p.despues.avisos ? `avisos ${p.antes.avisos} → ${p.despues.avisos}` : null;
    titulo = (
      <>
        Borrador de <strong className="font-medium">{p.nombre}</strong>
        {delta && <span className={`ml-2 text-[11px] ${p.despues.errores ? "text-bad" : "text-ok"}`}>{delta}</span>}
      </>
    );
    const t = antes ? p.antes : p;
    detalle = (
      <div className="mt-2 rounded-lg border border-line bg-surface px-3 py-2">
        <div className="mb-1 flex gap-3 text-[11px] text-ink-3">
          <button type="button" className={!antes ? "text-ink" : ""} onClick={() => setAntes(false)}>Propuesto</button>
          <button type="button" className={antes ? "text-ink" : ""} onClick={() => setAntes(true)}>Actual</button>
        </div>
        <p className="text-xs font-medium">{t.asunto}</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{t.cuerpo}</p>
      </div>
    );
  } else if (p.tipo === "editar_plantilla") {
    titulo = <>Plantilla <strong className="font-medium">{p.clave}</strong></>;
    detalle = (
      <div className="mt-2 rounded-lg border border-line bg-surface px-3 py-2">
        <p className="text-xs font-medium">{p.asunto}</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{p.cuerpo}</p>
      </div>
    );
  } else {
    titulo =
      p.tipo === "crear_borradores" ? <>Crear {p.prospectIds.length} borrador(es){p.sinVariables ? " sin variables" : ""}</>
      : p.tipo === "descartar_borradores" ? <>Descartar {p.ids.length} borrador(es)</>
      : <>Etiquetar {p.prospectIds.length} con “{p.etiqueta}”</>;
    detalle = <p className="mt-1 text-xs text-ink-2">{p.nombres.join(", ")}</p>;
  }
  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} className="mt-0.5 accent-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span>{titulo}</span>
            <button type="button" className="shrink-0 text-ink-3 hover:text-ink" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar" : "Ver"}</button>
          </div>
          <p className="text-ink-2">{p.motivo}</p>
          {ver && detalle}
        </div>
      </div>
    </li>
  );
}
