"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Download, ExternalLink, LoaderCircle, Sparkles, X } from "lucide-react";
import { toast } from "@/components/toaster";

type Fuente = { url: string; titulo: string; formato: string; descripcion: string; directo: boolean };
type Avance = { texto: string; hechos?: number; total?: number };

/** Lee una respuesta NDJSON y llama `on` con cada evento. */
async function leer(res: Response, on: (ev: Record<string, unknown> & { tipo: string }) => void) {
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo.");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const linea = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (linea.trim()) on(JSON.parse(linea));
    }
  }
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** Prompt del agente: busca de dónde sacar datos y los carga (como carga nueva o sumándolos a `cargaId`). */
export function AgenteCarga({ cargaId }: { cargaId?: number }) {
  const router = useRouter();
  const [pedido, setPedido] = useState("");
  const [buscando, setBuscando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ resumen: string; fuentes: Fuente[] } | null>(null);
  const [cargando, setCargando] = useState<{ url: string; avance: Avance } | null>(null);

  const buscar = async () => {
    const p = pedido.trim();
    if (!p) return;
    setResultado(null);
    setBuscando("Pensando dónde buscar…");
    try {
      await leer(await fetch("/api/directorio/agente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido: p }) }), (ev) => {
        if (ev.tipo === "actividad") setBuscando(String(ev.texto));
        else if (ev.tipo === "fuentes") setResultado({ resumen: String(ev.resumen), fuentes: ev.fuentes as Fuente[] });
        else if (ev.tipo === "error") throw new Error(String(ev.error));
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBuscando(null);
    }
  };

  const cargar = async (f: Fuente) => {
    setCargando({ url: f.url, avance: { texto: "Descargando…" } });
    let destino: string | null = null;
    try {
      await leer(
        await fetch("/api/directorio/cargar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: f.url, cargaId }) }),
        (ev) => {
          const set = (a: Avance) => setCargando({ url: f.url, avance: a });
          if (ev.tipo === "actividad") set({ texto: String(ev.texto) });
          else if (ev.tipo === "inicio") set({ texto: ev.negocios ? `${Number(ev.negocios).toLocaleString("es-MX")} correos · ${ev.giros} giros` : "Leyendo y clasificando…", hechos: 0, total: Number(ev.total) });
          else if (ev.tipo === "progreso") setCargando((c) => (c ? { ...c, avance: { ...c.avance, hechos: Number(ev.hechos), total: Number(ev.total) } } : c));
          else if (ev.tipo === "pensando") set({ texto: "Pensando ideas y título…" });
          else if (ev.tipo === "aviso") toast(String(ev.mensaje), "info");
          else if (ev.tipo === "vacio") toast("Ese archivo no trae correos.", "info");
          else if (ev.tipo === "guardado") destino = `/directorio/cargar/${ev.id}`;
          else if (ev.tipo === "agregado") {
            toast(Number(ev.nuevos) ? `${ev.nuevos} correos nuevos en esta carga.` : "No había correos nuevos.");
            setResultado(null);
            setPedido("");
            router.refresh();
          } else if (ev.tipo === "error") throw new Error(String(ev.error));
        },
      );
      if (destino) return router.push(destino);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
    setCargando(null);
  };

  const ocupado = !!buscando || !!cargando;
  return (
    <div className="card mb-6 px-4 py-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <Sparkles size={16} className="shrink-0 text-accent" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          placeholder={cargaId ? "Pídele que busque más para esta carga: el DENUE de Jalisco, hoteles de Oaxaca…" : "Pídele al agente que busque datos: el directorio del INEGI de Jalisco…"}
          value={pedido}
          maxLength={1000}
          onChange={(e) => setPedido(e.target.value)}
          disabled={ocupado}
          aria-label="Pedido para el agente"
        />
        <button type="submit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40" disabled={ocupado || !pedido.trim()} aria-label="Buscar">
          {buscando ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUp size={15} />}
        </button>
      </form>

      {buscando && <p className="mt-2 truncate pl-6 text-xs text-ink-3">{buscando}</p>}

      {resultado && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm text-ink-2">{resultado.resumen}</p>
            <button type="button" className="btn btn-quiet btn-icon shrink-0" onClick={() => setResultado(null)} aria-label="Cerrar" disabled={!!cargando}><X size={14} /></button>
          </div>
          {!resultado.fuentes.length && <p className="text-sm text-ink-3">No encontró una fuente descargable.</p>}
          <ul className="divide-y divide-line">
            {resultado.fuentes.map((f) => {
              const activa = cargando?.url === f.url;
              return (
                <li key={f.url} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{f.titulo}</span>
                      <span className="shrink-0 rounded-full bg-[#efede5] px-1.5 text-[11px] font-normal text-ink-2">{f.formato}</span>
                    </span>
                    <span className="block truncate text-xs text-ink-3">{host(f.url)} · {f.descripcion}</span>
                    {activa && (
                      <span className="mt-1.5 block">
                        <span className="block text-xs text-ink-2">{cargando.avance.texto}</span>
                        {!!cargando.avance.total && (
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#f1efe8]">
                            <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(((cargando.avance.hechos ?? 0) / cargando.avance.total) * 100)}%` }} />
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <a href={f.url} target="_blank" rel="noreferrer" className="btn btn-quiet btn-icon" aria-label="Abrir fuente"><ExternalLink size={14} /></a>
                  {(f.directo || !/p[aá]gina/i.test(f.formato)) && (
                    <button type="button" className="btn btn-sm" disabled={!!cargando} onClick={() => cargar(f)}>
                      {activa ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} {cargaId ? "Agregar" : "Cargar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
