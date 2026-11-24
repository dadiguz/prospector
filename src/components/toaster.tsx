"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

/**
 * Avisos en la parte de arriba. Cualquier componente cliente llama toast("…").
 * Todos se pueden cerrar; los de error se quedan hasta que los cierras.
 */
export type ToastTone = "ok" | "error" | "info";
type Enlace = { href: string; label: string };
type Toast = { id: number; texto: string; tono: ToastTone; enlace?: Enlace };

export function toast(texto: string, tono: ToastTone = "ok", enlace?: Enlace) {
  window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>("toast", { detail: { texto, tono, enlace } }));
}

const TONO: Record<ToastTone, string> = {
  ok: "border-ok/30 bg-ok-soft text-ok",
  error: "border-bad/30 bg-bad-soft text-bad",
  info: "border-line bg-surface text-ink",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const cerrar = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++n;
      setItems((xs) => [...xs.filter((x) => x.texto !== d.texto).slice(-3), { id, ...d }]);
      if (d.tono !== "error") setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), d.enlace ? 8000 : 4500);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border py-2.5 pl-4 pr-2 text-sm shadow-sm ${TONO[t.tono]}`}>
          <span className="min-w-0 flex-1 pt-0.5">
            {t.texto}
            {t.enlace && (
              <>
                {" "}
                <Link href={t.enlace.href} onClick={() => cerrar(t.id)} className="font-medium underline underline-offset-4">{t.enlace.label}</Link>
              </>
            )}
          </span>
          <button type="button" onClick={() => cerrar(t.id)} className="shrink-0 rounded-md p-1 opacity-60 hover:bg-black/5 hover:opacity-100" aria-label="Cerrar aviso">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
