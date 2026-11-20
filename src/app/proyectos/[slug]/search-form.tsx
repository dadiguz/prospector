"use client";

import { startSearch } from "@/app/actions";
import { FormMessage, StatefulForm } from "@/components/client";

export function SearchForm({ segmentId, defaultBudget, disabled }: { segmentId: number; defaultBudget: number; disabled: boolean }) {
  return (
    <StatefulForm action={startSearch} className="flex flex-col items-end gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="segmentId" value={segmentId} />
          <div className="flex flex-wrap items-end justify-end gap-2">
            <label className="text-xs text-ink-2">
              Contacto
              <select name="canal" defaultValue="correo" className="select mt-1 w-36">
                <option value="correo">Correo</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="cualquiera">Cualquiera</option>
              </select>
            </label>
            <label className="text-xs text-ink-2">
              Sólidos
              <input name="cuantos" type="number" min={1} max={25} defaultValue={10} className="input mt-1 w-20" />
            </label>
            <label className="text-xs text-ink-2">
              Tope US$
              <input name="presupuesto" type="number" min={0.5} max={50} step={0.5} defaultValue={defaultBudget} className="input mt-1 w-20" />
            </label>
            <button className="btn btn-primary" disabled={pending || disabled}>
              {pending ? "Iniciando…" : "Buscar prospectos"}
            </button>
          </div>
          <FormMessage state={state} />
        </>
      )}
    </StatefulForm>
  );
}
