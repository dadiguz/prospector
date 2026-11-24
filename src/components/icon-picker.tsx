"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { COLORES_PROYECTO, ICONOS_PROYECTO, ProjectIcon } from "@/lib/project-icons";

/** Ícono y color del proyecto: clic en el ícono para cambiarlos. */
export function IconPicker({ nombre, icono, color, onChange }: { nombre: string; icono?: string | null; color?: string | null; onChange: (v: { icono: string; color: string }) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const ic = icono && ICONOS_PROYECTO[icono] ? icono : "maletin";
  const co = color && COLORES_PROYECTO[color] ? color : "terracota";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-[10px] ring-offset-2 hover:ring-2 hover:ring-line-strong" aria-label="Cambiar ícono y color" title="Cambiar ícono y color">
        <ProjectIcon nombre={nombre || "?"} icono={icono} color={color} size={40} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[19rem] rounded-xl border border-line bg-surface p-3 shadow-lg">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.entries(COLORES_PROYECTO).map(([k, c]) => (
              <button key={k} type="button" onClick={() => onChange({ icono: ic, color: k })} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: c.fg }} aria-label={`Color ${k}`} title={k}>
                {k === co && <Check size={13} strokeWidth={3} className="text-white" />}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {Object.entries(ICONOS_PROYECTO).map(([k, v]) => {
              const I = v.icono;
              const on = k === icono;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange({ icono: k, color: co })}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${on ? "" : "text-ink-2 hover:bg-[#f3f1ea]"}`}
                  style={on ? { background: COLORES_PROYECTO[co].bg, color: COLORES_PROYECTO[co].fg } : undefined}
                  aria-label={v.para}
                  title={v.para}
                >
                  <I size={17} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
