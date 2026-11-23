"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelJob } from "@/app/actions";
import { TagChip } from "./ui";
import { toast } from "./toaster";
import { Minus } from "lucide-react";

type Busqueda = {
  id: number; estado: string; mensaje: string | null; proyecto: string; slug: string;
  tag: { id: number; nombre: string; color: string } | null;
  pasos: number; hechos: number; costo: number; tope: number | null; encontrados: number;
  paso: string | null; ultima: string | null;
};

const ESTADO: Record<string, { label: string; cls: string }> = {
  en_curso: { label: "Buscando", cls: "bg-accent-soft text-accent" },
  pendiente: { label: "En cola", cls: "bg-[#f1efe8] text-ink-2" },
  en_pausa: { label: "En pausa", cls: "bg-warn-soft text-warn" },
  hecho: { label: "Terminó", cls: "bg-ok-soft text-ok" },
  fallo: { label: "Falló", cls: "bg-bad-soft text-bad" },
  cancelado: { label: "Cancelada", cls: "bg-[#f1efe8] text-ink-2" },
};
const ACTIVA = new Set(["en_curso", "pendiente", "en_pausa"]);

/** Panel a la derecha con las búsquedas que están corriendo (y las que acaban de terminar). */
export function RunningPanel() {
  const [items, setItems] = useState<Busqueda[]>([]);
  // El panel no se pinta hasta tener datos del servidor, así que leer la preferencia aquí no desajusta la hidratación.
  const [abierto, setAbierto] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem("panel-busquedas") !== "0";
    } catch {
      return true;
    }
  });
  const [, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    let antes = "";
    const cargar = async () => {
      try {
        const r = await fetch("/api/busquedas", { cache: "no-store" });
        const { busquedas } = (await r.json()) as { busquedas: Busqueda[] };
        if (!vivo) return;
        setItems(busquedas);
        // Cuando una búsqueda cambia de estado, refresca la página para que las listas se actualicen.
        const firma = busquedas.map((b) => `${b.id}:${b.estado}`).join(",");
        if (antes && firma !== antes) router.refresh();
        antes = firma;
        timer = setTimeout(cargar, busquedas.some((b) => ACTIVA.has(b.estado)) ? 4000 : 20000);
      } catch {
        timer = setTimeout(cargar, 20000);
      }
    };
    void cargar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [router]);

  const toggle = (v: boolean) => {
    setAbierto(v);
    try {
      localStorage.setItem("panel-busquedas", v ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  };

  // En pantallas anchas el panel queda fijo a la derecha y el contenido se recorre para no quedar debajo.
  const visible = abierto && items.length > 0;
  useEffect(() => {
    document.documentElement.dataset.panel = visible ? "1" : "";
  }, [visible]);

  if (!items.length) return null;
  const activas = items.filter((b) => ACTIVA.has(b.estado)).length;

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-sm"
      >
        {activas > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
        {activas > 0 ? `${activas} buscando` : "Búsquedas recientes"}
      </button>
    );

  return (
    <aside
      aria-label="Búsquedas en curso"
      className="fixed bottom-4 right-4 z-30 flex max-h-[calc(100vh-6rem)] w-[min(20rem,calc(100vw-2rem))] flex-col rounded-2xl border border-line bg-surface shadow-sm xl:top-20 xl:bottom-auto xl:shadow-none"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {activas > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
          {activas > 0 ? `Buscando (${activas})` : "Búsquedas recientes"}
        </h2>
        <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => toggle(false)} aria-label="Minimizar">
          <Minus size={15} strokeWidth={1.8} />
        </button>
      </div>
      <ul className="divide-y divide-line overflow-y-auto">
        {items.map((b) => {
          const e = ESTADO[b.estado] ?? ESTADO.pendiente;
          const pct = b.pasos ? Math.round((b.hechos / b.pasos) * 100) : 0;
          return (
            <li key={b.id} className="space-y-1.5 px-4 py-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 font-medium ${e.cls}`}>{e.label}</span>
                <span className="truncate text-ink-3">{b.proyecto}</span>
              </div>
              {b.tag && <TagChip nombre={b.tag.nombre} color={b.tag.color} />}
              {ACTIVA.has(b.estado) ? (
                <>
                  {b.paso && <p className="truncate text-ink">{b.paso}</p>}
                  {b.ultima && <p className="truncate text-ink-3">{b.ultima}</p>}
                  <div className="h-1 overflow-hidden rounded-full bg-[#efede5]" aria-hidden="true">
                    <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-ink-3">
                    <span>
                      {b.hechos}/{b.pasos} pasos · US${b.costo.toFixed(2)}{b.tope ? ` de ${b.tope}` : ""}
                    </span>
                    <button
                      type="button"
                      className="text-ink-2 underline-offset-4 hover:text-bad hover:underline"
                      onClick={() => {
                        if (window.confirm("¿Cancelar esta búsqueda? Lo encontrado se queda.")) start(async () => {
                          const r = await cancelJob(b.id);
                          if (r?.message) toast(r.message, "info");
                        });
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <p className="line-clamp-2 text-ink-2">{b.mensaje}</p>
              )}
              {b.tag && b.encontrados > 0 && (
                <Link href={`/proyectos/${b.slug}/prospectos?tag=${b.tag.id}&todos=1`} className="inline-block text-accent underline-offset-4 hover:underline">
                  Ver resultados ({b.encontrados})
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
