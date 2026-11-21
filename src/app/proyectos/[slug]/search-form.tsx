"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startSearch } from "@/app/actions";
import { toast } from "@/components/toaster";
import { Field } from "@/components/wand-field";

/**
 * Lanzar una búsqueda para un segmento. Mientras haya una búsqueda de este segmento en curso o en cola,
 * el botón dice "En curso" y no se puede volver a lanzar (las de otros segmentos sí).
 */
export function SearchForm({ segmentId, segmento, defaultBudget, enCurso, contexto = "" }: { segmentId: number; segmento: string; defaultBudget: number; enCurso: boolean; contexto?: string }) {
  const [indicaciones, setIndicaciones] = useState("");
  const [pending, start] = useTransition();
  const [lanzada, setLanzada] = useState(false); // optimista: hasta que la página se refresque con el estado real
  const router = useRouter();
  const ocupado = enCurso || lanzada;

  return (
    <form
      className="mt-4 flex flex-col gap-3 border-t border-line pt-4"
      action={(fd) =>
        start(async () => {
          const r = await startSearch(null, fd);
          if (r?.error) {
            toast(r.error, "error");
            return;
          }
          setLanzada(true);
          const canal = String(fd.get("canal"));
          toast(`Búsqueda iniciada: ${segmento}${canal === "whatsapp" ? " · WhatsApp" : canal === "cualquiera" ? " · cualquier contacto" : ""}. Síguela en el panel de la derecha.`);
          router.refresh();
          // Si el refresco trae el estado real, éste manda; el optimista se apaga solo.
          setTimeout(() => setLanzada(false), 8000);
        })
      }
    >
      <input type="hidden" name="segmentId" value={segmentId} />
      <input type="hidden" name="indicaciones" value={indicaciones} />
      <Field
        label="Indicaciones para esta búsqueda (opcional)"
        rows={2}
        value={indicaciones}
        onChange={setIndicaciones}
        campo="instrucciones_busqueda"
        contexto={contexto}
        placeholder="Ej. solo Tijuana y Mexicali, plantas de más de 300 operadores, que fabriquen arneses; evita las que ya usan MES"
      />
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label className="text-xs text-ink-2">
          Contacto
          <select name="canal" defaultValue="correo" className="select mt-1 w-36" disabled={ocupado}>
            <option value="correo">Correo</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="cualquiera">Cualquiera</option>
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Sólidos
          <input name="cuantos" type="number" min={1} max={25} defaultValue={10} className="input mt-1 w-20" disabled={ocupado} />
        </label>
        <label className="text-xs text-ink-2">
          Tope US$
          <input name="presupuesto" type="number" min={0.5} max={50} step={0.5} defaultValue={defaultBudget} className="input mt-1 w-20" disabled={ocupado} />
        </label>
        <button
          className={`btn min-w-[10.5rem] justify-center ${ocupado ? "cursor-default" : "btn-primary"}`}
          disabled={pending || ocupado}
          // .btn no está en una capa de Tailwind: el estado "En curso" se pinta con estilo en línea.
          style={ocupado ? { opacity: 1, background: "var(--accent-soft)", borderColor: "var(--accent-soft)", color: "var(--accent)" } : undefined}
          aria-live="polite"
        >
          {pending ? (
            "Iniciando…"
          ) : ocupado ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" /> En curso
            </>
          ) : (
            "Buscar prospectos"
          )}
        </button>
      </div>
    </form>
  );
}
