"use client";

import { useEffect, useState } from "react";

/** Avisos breves en la esquina. Cualquier componente cliente llama toast("…"). */
export type ToastTone = "ok" | "error" | "info";
type Toast = { id: number; texto: string; tono: ToastTone };

export function toast(texto: string, tono: ToastTone = "ok") {
  window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>("toast", { detail: { texto, tono } }));
}

const TONO: Record<ToastTone, string> = {
  ok: "border-ok/30 bg-ok-soft text-ok",
  error: "border-bad/30 bg-bad-soft text-bad",
  info: "border-line bg-surface text-ink",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { id, ...d }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), d.tono === "error" ? 7000 : 4500);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-sm shadow-sm ${TONO[t.tono]}`}>
          {t.texto}
        </div>
      ))}
    </div>
  );
}
