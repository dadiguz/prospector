"use client";

import { useState, useTransition } from "react";
import { ArrowUp, LoaderCircle, Sparkles } from "lucide-react";
import { suggestFollowup, suggestReply } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { toast } from "@/components/toaster";

/**
 * Agente que propone una respuesta (o un seguimiento) y la rehace con lo que le pidas.
 * Solo redacta: copiar y mandar sigue siendo cosa tuya.
 */
export function AgentReply({ tipo, id, sugerencia }: { tipo: "respuesta" | "seguimiento"; id: number; sugerencia: string | null }) {
  const [pending, start] = useTransition();
  const [indicacion, setIndicacion] = useState("");

  const pedir = (ind?: string) =>
    start(async () => {
      const r = tipo === "respuesta" ? await suggestReply(id, ind) : await suggestFollowup(id, ind);
      if (r?.error) toast(r.error, "error");
      else setIndicacion("");
    });

  if (!sugerencia) {
    return (
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => pedir()}>
        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {pending ? "Redactando…" : tipo === "respuesta" ? "Proponer respuesta" : "Proponer seguimiento"}
      </button>
    );
  }

  const limpio = sugerencia.replace(/\n?\[REVISAR\][\s\S]*$/, "").trim();
  return (
    <div className={`mt-4 rounded-xl border border-line bg-bg px-4 py-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <Sparkles size={13} className="text-accent" />
          {tipo === "respuesta" ? "Respuesta propuesta" : "Seguimiento propuesto"}
        </span>
        <CopyButton text={limpio} className="btn btn-sm" />
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {sugerencia.split(/(\[REVISAR\][\s\S]*)/).map((part, i) =>
          part.startsWith("[REVISAR]") ? <mark key={i} className="suposicion mt-2 block">{part}</mark> : <span key={i}>{part}</span>,
        )}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (indicacion.trim()) pedir(indicacion.trim());
        }}
      >
        <input
          className="input flex-1 text-sm"
          style={{ height: "2rem" }}
          placeholder="Pídele un cambio: más corto, propón el jueves, menos formal…"
          value={indicacion}
          maxLength={500}
          onChange={(e) => setIndicacion(e.target.value)}
          disabled={pending}
          aria-label="Cambio para el agente"
        />
        <button
          type="submit"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
          disabled={pending || !indicacion.trim()}
          aria-label="Rehacer"
        >
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUp size={15} />}
        </button>
      </form>
    </div>
  );
}
