"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createDraftsBulk, tagProspects, type FormState } from "@/app/actions";

/** Casilla de una fila. No abre la ficha al marcarla. */
export function RowCheckbox({ id }: { id: number }) {
  return (
    <input
      type="checkbox"
      name="sel"
      value={id}
      form="bulk-prospectos"
      aria-label="Seleccionar"
      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      onClick={(e) => e.stopPropagation()}
      onChange={() => document.dispatchEvent(new Event("sel-change"))}
    />
  );
}

const checks = () => [...document.querySelectorAll<HTMLInputElement>('input[name="sel"][form="bulk-prospectos"]')];

export function BulkBar({ projectId, slug, tagId, total }: { projectId: number; slug: string; tagId: number | null; total: number }) {
  const [count, setCount] = useState(0);
  const [tagName, setTagName] = useState("");
  const [state, setState] = useState<(FormState & { creados?: number }) | null>(null);
  const [pending, start] = useTransition();

  const recount = () => setCount(checks().filter((c) => c.checked).length);
  const selected = () => checks().filter((c) => c.checked).map((c) => Number(c.value));

  return (
    <form
      id="bulk-prospectos"
      className="card sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
      onSubmit={(e) => e.preventDefault()}
      onChangeCapture={recount}
      ref={(el) => {
        if (!el) return;
        const h = () => recount();
        document.addEventListener("sel-change", h);
        return () => document.removeEventListener("sel-change", h);
      }}
    >
      <button
        type="button"
        className="btn btn-quiet"
        onClick={() => {
          const all = checks();
          const marcar = all.some((c) => !c.checked);
          all.forEach((c) => (c.checked = marcar));
          recount();
        }}
      >
        {count && count === total ? "Quitar selección" : `Seleccionar todos (${total})`}
      </button>
      <span className="text-ink-3">{count} seleccionado(s)</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <input className="input w-40 py-1.5" placeholder="Nueva etiqueta" value={tagName} onChange={(e) => setTagName(e.target.value)} />
        <button
          type="button"
          className="btn"
          disabled={!count || !tagName.trim() || pending}
          onClick={() => start(async () => { setState(await tagProspects(projectId, selected(), tagName)); setTagName(""); })}
        >
          Etiquetar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!count || pending}
          onClick={() => start(async () => setState(await createDraftsBulk(selected())))}
        >
          {pending ? "Trabajando…" : `Crear borradores (${count})`}
        </button>
      </div>
      {state && (
        <div className="w-full space-y-1 pt-1">
          {state.message && (
            <p className="text-ok">
              {state.message}{" "}
              {state.creados ? (
                <Link href={`/proyectos/${slug}/borradores${tagId ? `?tag=${tagId}` : ""}`} className="underline underline-offset-4">Ir a borradores</Link>
              ) : null}
            </p>
          )}
          {state.error && <p className="text-xs text-bad">{state.error}</p>}
        </div>
      )}
    </form>
  );
}
