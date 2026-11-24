"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

/**
 * Buscador de una lista. Guarda la búsqueda en la URL (?q=) para que el servidor filtre
 * y se conserve al recargar; respeta los demás filtros de la página.
 */
export function SearchBox({ placeholder = "Buscar", className = "" }: { placeholder?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actual = params.get("q") ?? "";
  const [valor, setValor] = useState(actual);
  const [pending, start] = useTransition();
  const ultimo = useRef(actual);

  useEffect(() => {
    if (valor.trim() === ultimo.current.trim()) return;
    const t = setTimeout(() => {
      ultimo.current = valor;
      const p = new URLSearchParams(params.toString());
      if (valor.trim()) p.set("q", valor.trim());
      else p.delete("q");
      start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [valor, params, pathname, router]);

  return (
    <label className={`relative block min-w-[12rem] ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        className="input w-full"
        style={{ paddingLeft: "2.1rem", paddingRight: "2rem" }}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setValor("")}
        aria-label={placeholder}
        type="search"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3">
        {pending ? (
          <LoaderCircle size={14} className="animate-spin" aria-hidden />
        ) : valor ? (
          <button type="button" onClick={() => setValor("")} className="flex rounded p-0.5 hover:text-ink" aria-label="Borrar búsqueda">
            <X size={14} />
          </button>
        ) : null}
      </span>
    </label>
  );
}
