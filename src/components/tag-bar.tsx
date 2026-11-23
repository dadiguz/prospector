"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TagChip } from "./ui";

export type TagItem = { id: number; nombre: string; color: string; total?: number; tipo?: string; href: string };

const grupo = (t: TagItem) => (t.tipo === "usuario" ? "Tus etiquetas" : /^(Tanda|Bitácora)/.test(t.nombre) ? "Tandas importadas" : "Búsquedas");

/** Etiquetas recientes a la vista; el resto en una ventana con buscador. */
export function TagBar({ tags, active, clearHref, visibles = 0 }: { tags: TagItem[]; active: number | null; clearHref: string; visibles?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const recientes = useMemo(() => {
    const orden = [...tags].sort((a, b) => b.id - a.id);
    const top = orden.slice(0, visibles);
    const act = orden.find((t) => t.id === active);
    return act && !top.includes(act) ? [act, ...top.slice(0, visibles - 1)] : top;
  }, [tags, active, visibles]);
  const resto = tags.length - recientes.length;
  const filtradas = tags
    .filter((t) => t.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")))
    .sort((a, b) => b.id - a.id);
  const grupos = ["Búsquedas", "Tus etiquetas", "Tandas importadas"].map((g) => [g, filtradas.filter((t) => grupo(t) === g)] as const).filter(([, xs]) => xs.length);

  if (!tags.length) return null;
  const activa = tags.find((t) => t.id === active);
  void recientes;
  void resto;
  return (
    <div className="flex items-center gap-1.5">
      {activa ? (
        <>
          <button type="button" onClick={() => dialog.current?.showModal()} title="Cambiar etiqueta">
            <TagChip nombre={activa.nombre} color={activa.color} active count={activa.total} />
          </button>
          <Link href={clearHref} className="text-xs text-ink-3 hover:text-ink" aria-label="Quitar filtro">✕</Link>
        </>
      ) : (
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-ink-2 hover:bg-[#efede5]" onClick={() => dialog.current?.showModal()}>
          Etiqueta ▾
        </button>
      )}

      <dialog
        ref={dialog}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-black/20"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-medium">Todas las etiquetas</h2>
          <button type="button" className="btn btn-quiet px-2" aria-label="Cerrar" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <div className="px-5 pt-4">
          <input className="input" placeholder="Buscar etiqueta" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
          {grupos.length === 0 && <p className="text-sm text-ink-2">Ninguna etiqueta coincide.</p>}
          {grupos.map(([g, xs]) => (
            <section key={g}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">{g}</h3>
              <div className="flex flex-wrap gap-1.5">
                {xs.map((t) => (
                  <Link key={t.id} href={active === t.id ? clearHref : t.href} onClick={() => dialog.current?.close()}>
                    <TagChip nombre={t.nombre} color={t.color} active={active === t.id} count={t.total} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </dialog>
    </div>
  );
}
