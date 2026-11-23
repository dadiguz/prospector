"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Info as InfoIcon } from "lucide-react";

/** Icono ⓘ: el detalle aparece al pasar el cursor o al tocarlo. Para lo que no hace falta ver siempre. */
export function Info({ children, label = "Más información", className = "" }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [fijo, setFijo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!fijo) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && (setFijo(false), setOpen(false));
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [fijo]);
  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => !fijo && setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full text-ink-3 transition-colors hover:text-ink"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setFijo((f) => !f);
          setOpen(true);
        }}
      >
        <InfoIcon size={15} strokeWidth={1.7} aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1.5 block w-72 -translate-x-1/2 whitespace-normal rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Texto recortado a unas líneas, con "ver más" solo si de verdad no cabe. */
export function More({ children, lines = 2, className = "" }: { children: ReactNode; lines?: number; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [corta, setCorta] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !abierto) setCorta(el.scrollHeight > el.clientHeight + 2);
  }, [children, abierto]);
  return (
    <div className={className}>
      <div ref={ref} style={abierto ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {children}
      </div>
      {(corta || abierto) && (
        <button type="button" className="mt-0.5 text-xs text-ink-3 hover:text-ink" onClick={() => setAbierto((a) => !a)}>
          {abierto ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
