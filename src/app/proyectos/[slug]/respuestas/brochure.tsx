"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Download, FileText, LoaderCircle } from "lucide-react";
import { makeBrochure } from "@/app/actions";
import { toast } from "@/components/toaster";

type Estado = { pdf: boolean; paginas: number; actualizado: string | null };

/** Botón para generar el brochure de quien respondió y, ya hecho, sus páginas y el PDF. */
export function BrochureButton({ replyId, estado }: { replyId: number; estado: Estado }) {
  const [pending, start] = useTransition();
  if (estado.pdf) return null;
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await makeBrochure(replyId);
          if (r?.error) toast(r.error, "error");
          else toast("Brochure listo.");
        })
      }
      title="Lee su sitio, usa sus fotos y precios y arma un PDF de 6 páginas"
    >
      {pending ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}
      {pending ? "Armando brochure… (1 min)" : "Generar brochure"}
    </button>
  );
}

export function BrochurePanel({ replyId, prospectId, estado }: { replyId: number; prospectId: number; estado: Estado }) {
  const [pending, start] = useTransition();
  const [indicacion, setIndicacion] = useState("");
  if (!estado.pdf) return null;
  const v = encodeURIComponent(estado.actualizado ?? "");
  const base = `/api/brochure/${prospectId}`;
  const rehacer = (ind?: string) =>
    start(async () => {
      const r = await makeBrochure(replyId, ind);
      if (r?.error) toast(r.error, "error");
      else {
        setIndicacion("");
        toast("Brochure actualizado.");
      }
    });

  return (
    <div className={`mt-4 rounded-xl border border-line bg-bg px-4 py-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <FileText size={13} className="text-accent" />
          Brochure
        </span>
        <span className="flex flex-wrap gap-2">
          <a className="btn btn-sm" href={`${base}/brochure.pdf?v=${v}`} target="_blank" rel="noreferrer">Ver PDF</a>
          <a className="btn btn-sm" href={`${base}/brochure.pdf?descargar&v=${v}`}>
            <Download size={13} /> Descargar
          </a>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: estado.paginas }, (_, i) => (
          <a key={i} href={`${base}/pagina-${i + 1}.png?descargar&v=${v}`} title={`Descargar página ${i + 1} (para WhatsApp)`} className="block overflow-hidden rounded-md border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/pagina-${i + 1}.png?v=${v}`} alt={`Página ${i + 1}`} className="aspect-[4/5] w-full object-cover" loading="lazy" />
          </a>
        ))}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (indicacion.trim()) rehacer(indicacion.trim());
        }}
      >
        <input
          className="input input-sm flex-1"
          placeholder="Pídele un cambio: otro título, usa la foto de la alberca, enfócate en eventos…"
          value={indicacion}
          maxLength={500}
          onChange={(e) => setIndicacion(e.target.value)}
          disabled={pending}
          aria-label="Cambio para el brochure"
        />
        <button
          type="submit"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
          disabled={pending || !indicacion.trim()}
          aria-label="Rehacer brochure"
        >
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUp size={15} />}
        </button>
      </form>
      {pending && <p className="mt-2 text-xs text-ink-3">Rehaciendo el brochure, tarda alrededor de un minuto…</p>}
    </div>
  );
}
