"use client";

import { useState, useTransition } from "react";
import { WandSparkles } from "lucide-react";
import { Info } from "./info";
import { improveField } from "@/app/actions";
import type { Campo } from "@/lib/wand";

/* ---------- Varita ---------- */

const WandIcon = () => <WandSparkles size={15} strokeWidth={1.6} aria-hidden />;

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
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { onApply(res.sugerencia ?? value); setRes(null); }}>
                  Usar
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRes(null)}>Descartar</button>
              </div>
            </>
          )}
          {res.error && <button type="button" className="btn btn-quiet btn-sm mt-2" onClick={() => setRes(null)}>Cerrar</button>}
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
  /** Sin etiqueta visible (filas repetidas: la etiqueta va solo en la primera). */
  bare?: boolean;
};

export function Field({ label, hint, value, onChange, campo, contexto = "", rows, placeholder, mono, bare }: FieldProps) {
  const cls = `${rows ? "textarea" : "input"} ${mono ? "font-mono text-[13px]" : ""}`;
  const style = campo ? { paddingRight: "2.25rem" } : undefined;
  return (
    <label className="block">
      <span className={bare ? "sr-only" : "label"}>{label}{hint && !bare && <Info label={`Sobre ${label}`}>{hint}</Info>}</span>
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
