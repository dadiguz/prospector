"use client";

import { useState, useTransition } from "react";
import { Info } from "./info";
import { improveField } from "@/app/actions";
import type { Campo } from "@/lib/wand";

/* ---------- Varita ---------- */

function WandIcon() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3.5 16.5l9-9" />
      <path d="M11 6l3 3" />
      <path d="M14.5 2.5v2.5M13.25 3.75h2.5M17 7.5v1.8M16.1 8.4h1.8M8.5 2.8v1.4M7.8 3.5h1.4" />
    </svg>
  );
}

type WandProps = { campo: Campo; etiqueta: string; value: string; contexto: string; onApply: (v: string) => void };

export function Wand({ campo, etiqueta, value, contexto, onApply }: WandProps) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ sugerencia?: string; motivo?: string; error?: string } | null>(null);
  return (
    <>
      <button
        type="button"
        title={value.trim() ? "Mejorar con IA" : "Proponer con IA"}
        aria-label={`${value.trim() ? "Mejorar" : "Proponer"} ${etiqueta} con IA`}
        disabled={pending}
        onClick={() => start(async () => setRes(await improveField(campo, etiqueta, value, contexto)))}
        className={`absolute right-2 top-2 rounded-md p-1 text-ink-3 hover:bg-accent-soft hover:text-accent disabled:opacity-60 ${pending ? "animate-pulse text-accent" : ""}`}
      >
        <WandIcon />
      </button>
      {res && (
        <div className="mt-2 rounded-lg border border-accent/40 bg-accent-soft/50 p-3 text-sm">
          {res.error ? (
            <p className="text-bad">{res.error}</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap leading-relaxed">{res.sugerencia}</p>
              {res.motivo && <p className="mt-2 text-xs text-ink-2">{res.motivo}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary py-1 text-xs" onClick={() => { onApply(res.sugerencia ?? value); setRes(null); }}>
                  Usar
                </button>
                <button type="button" className="btn btn-quiet py-1 text-xs" onClick={() => setRes(null)}>Descartar</button>
              </div>
            </>
          )}
          {res.error && <button type="button" className="btn btn-quiet mt-2 py-1 text-xs" onClick={() => setRes(null)}>Cerrar</button>}
        </div>
      )}
    </>
  );
}

/* ---------- Campos ---------- */

export type FieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  campo?: Campo;
  contexto?: string;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
};

export function Field({ label, hint, value, onChange, campo, contexto = "", rows, placeholder, mono }: FieldProps) {
  const cls = `${rows ? "textarea" : "input"} ${mono ? "font-mono text-[13px]" : ""}`;
  const style = campo ? { paddingRight: "2.25rem" } : undefined;
  return (
    <label className="block">
      <span className="label flex items-center gap-1.5">{label}{hint && <Info label={`Sobre ${label}`}>{hint}</Info>}</span>
      <span className="relative block">
        {rows ? (
          <textarea className={cls} style={style} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input className={cls} style={style} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )}
        {campo && <Wand campo={campo} etiqueta={label} value={value} contexto={contexto} onApply={onChange} />}
      </span>
    </label>
  );
}
