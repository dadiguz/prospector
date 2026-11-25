"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileUp, Search, Trash2, X } from "lucide-react";
import { eliminarCarga } from "@/app/actions";
import type { CargaResumen } from "@/lib/carga";
import { coincide } from "@/lib/text";
import { toast } from "@/components/toaster";

type Fila = CargaResumen & { fecha: string };

/** Clave donde la versión anterior dejaba la carga en el navegador. */
const ANTERIOR = "carga-directorio";

export function ListaCargas({ cargas }: { cargas: Fila[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const visibles = cargas.filter((c) => coincide(q, c.titulo, c.archivos, c.fecha));

  // Si quedó una carga en este navegador (de antes del historial), se pasa a la lista.
  useEffect(() => {
    let crudo: string | null = null;
    try {
      crudo = sessionStorage.getItem(ANTERIOR);
      // Se quita antes de enviar para no guardarla dos veces; si falla, se regresa.
      if (crudo) sessionStorage.removeItem(ANTERIOR);
    } catch {
      return;
    }
    if (!crudo) return;
    const datos = crudo;
    void (async () => {
      const res = await fetch("/api/directorio/cargas", { method: "POST", headers: { "Content-Type": "application/json" }, body: datos }).catch(() => null);
      if (res?.ok) router.refresh();
      else if (res?.status !== 400) {
        try {
          sessionStorage.setItem(ANTERIOR, datos);
        } catch {
          /* sin almacenamiento */
        }
      }
    })();
  }, [router]);

  const borrar = (c: Fila) => {
    if (!confirm(`¿Quitar "${c.titulo}" del historial? Lo que ya agregaste al directorio se queda.`)) return;
    start(async () => {
      const r = await eliminarCarga(c.id);
      if (r?.error) toast(r.error, "error");
    });
  };

  if (!cargas.length)
    return (
      <div className="card mx-auto mt-6 max-w-md p-8 text-center">
        <FileUp size={26} className="mx-auto mb-3 text-ink-3" />
        <p className="font-medium">Aún no hay cargas</p>
        <Link href="/directorio/cargar/nueva" className="btn btn-primary mt-4">Nueva carga</Link>
      </div>
    );

  return (
    <div className={pending ? "opacity-60" : ""}>
      <label className="relative mb-3 block w-full sm:w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          className="input input-sm w-full"
          style={{ paddingLeft: "2.1rem", paddingRight: "2rem" }}
          placeholder="Buscar carga"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
          aria-label="Buscar carga"
          type="search"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 flex -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Borrar búsqueda">
            <X size={14} />
          </button>
        )}
      </label>
      <ul className="card divide-y divide-line overflow-hidden">
        {visibles.map((c) => (
          <li key={c.id} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#faf9f5]">
            <Link href={`/directorio/cargar/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.titulo}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{[c.fecha, c.archivos].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="hidden shrink-0 text-right text-xs text-ink-2 sm:block">
                {c.total} correos
                {c.agregados > 0 && <span className="block text-ok">{c.agregados} agregados</span>}
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden />
            </Link>
            <button type="button" className="btn btn-quiet btn-icon opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => borrar(c)} aria-label={`Quitar ${c.titulo}`}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {!visibles.length && <li className="px-4 py-6 text-center text-sm text-ink-3">Nada coincide con «{q}».</li>}
      </ul>
    </div>
  );
}
