"use client";

import { useState, useTransition } from "react";
import { createDraftsBulk, tagProspects, type FormState } from "@/app/actions";
import { Info } from "@/components/info";
import { toast } from "@/components/toaster";

/** Casilla de una fila. No abre la ficha al marcarla. */
export function RowCheckbox({ id }: { id: number }) {
  return (
    <input
      type="checkbox"
      name="sel"
      value={id}
      form="bulk-prospectos"
      aria-label="Seleccionar"
      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
      onClick={(e) => e.stopPropagation()}
      onChange={() => document.dispatchEvent(new Event("sel-change"))}
    />
  );
}

const checks = () => [...document.querySelectorAll<HTMLInputElement>('input[name="sel"][form="bulk-prospectos"]')];

export function BulkBar({ projectId, slug, tagId, total }: { projectId: number; slug: string; tagId: number | null; total: number }) {
  const [count, setCount] = useState(0);
  const [tagName, setTagName] = useState("");
  const [sinVariables, setSinVariables] = useState(true);
  // Resultados y avisos van a toasts que se pueden cerrar.
  const setState = (r: (FormState & { creados?: number }) | null) => {
    if (r?.message) toast(r.message, "ok", r.creados ? { href: `/proyectos/${slug}/borradores${tagId ? `?tag=${tagId}` : ""}`, label: "Ir a borradores" } : undefined);
    if (r?.error) toast(r.error, "error");
  };
  const [pending, start] = useTransition();

  const recount = () => setCount(checks().filter((c) => c.checked).length);
  const selected = () => checks().filter((c) => c.checked).map((c) => Number(c.value));

  const [etiquetando, setEtiquetando] = useState(false);

  return (
    <form
      id="bulk-prospectos"
      className={`sticky top-2 z-10 mb-3 flex min-h-[2.75rem] flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${count ? "card" : ""}`}
      onSubmit={(e) => e.preventDefault()}
      onChangeCapture={recount}
      ref={(el) => {
        if (!el) return;
        const h = () => recount();
        document.addEventListener("sel-change", h);
        return () => document.removeEventListener("sel-change", h);
      }}
    >
      <label className="flex cursor-pointer items-center gap-2 pl-2 text-ink-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={count > 0 && count === total}
          ref={(el) => {
            if (el) el.indeterminate = count > 0 && count < total;
          }}
          onChange={() => {
            const all = checks();
            const marcar = all.some((c) => !c.checked);
            all.forEach((c) => (c.checked = marcar));
            recount();
          }}
        />
        {count ? `${count} seleccionado(s)` : `Seleccionar todos (${total})`}
      </label>
      {count > 0 && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {etiquetando ? (
            <>
              <input className="input input-sm w-40" placeholder="Nombre de la etiqueta" value={tagName} onChange={(e) => setTagName(e.target.value)} autoFocus />
              <button
                type="button"
                className="btn"
                disabled={!tagName.trim() || pending}
                onClick={() => start(async () => { setState(await tagProspects(projectId, selected(), tagName)); setTagName(""); setEtiquetando(false); })}
              >
                Poner
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={() => setEtiquetando(true)}>Etiquetar</button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" checked={sinVariables} onChange={(e) => setSinVariables(e.target.checked)} className="accent-[var(--accent)]" />
            Sin variables
            <Info label="Qué es Sin variables">Si a un prospecto le falta un dato (por ejemplo la cifra), se quita esa frase en lugar de dejar un hueco como {"{cifra}"}.</Info>
          </label>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => setState(await createDraftsBulk(selected(), sinVariables)))}>
            {pending ? "Trabajando…" : `Crear ${count} borrador(es)`}
          </button>
        </div>
      )}
    </form>
  );
}
