"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ImagePlus, Layers, LoaderCircle, X } from "lucide-react";
import { armarTanda, cambiarTanda, deshacerTanda, quitarImagenTanda, renombrarTanda } from "@/app/actions";
import { toast } from "@/components/toaster";
import type { Lote } from "@/lib/lotes";

export type Vista = "todos" | "sin" | number;

const pillCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`;
export const imgUrl = (loteId: number, archivo: string) => `/api/lotes/${loteId}/${archivo}`;

/** Filtro por tanda y el control para armar la siguiente tanda de N. */
export function TandasBar({
  projectId, lotes, vista, setVista, total, sinTanda, listosSinTanda,
}: { projectId: number; lotes: Lote[]; vista: Vista; setVista: (v: Vista) => void; total: number; sinTanda: number; listosSinTanda: number[] }) {
  const [tam, setTam] = useState(10);
  const [pending, start] = useTransition();
  const activos = lotes.filter((l) => l.borradores > 0);
  const armar = () =>
    start(async () => {
      const r = await armarTanda(projectId, listosSinTanda.slice(0, tam));
      if (r?.error) toast(r.error, "error");
      else if (r?.loteId) {
        toast(r.message ?? "Tanda lista.");
        setVista(r.loteId);
      }
    });
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={pillCls(vista === "todos")} onClick={() => setVista("todos")}>Todos <span className="text-ink-3">{total}</span></button>
        {activos.length > 0 && (
          <button type="button" className={pillCls(vista === "sin")} onClick={() => setVista("sin")}>Sin tanda <span className="text-ink-3">{sinTanda}</span></button>
        )}
        {activos.map((l) => (
          <button key={l.id} type="button" className={pillCls(vista === l.id)} onClick={() => setVista(l.id)}>
            <Layers size={12} className="text-accent" /> {l.nombre} <span className="text-ink-3">{l.borradores}</span>
            {l.imagenes.length > 0 && <ImagePlus size={12} className="text-ink-3" aria-label="Con imágenes" />}
          </button>
        ))}
      </div>
      {listosSinTanda.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span>Tanda de</span>
          <input
            type="number"
            min={1}
            max={500}
            value={tam}
            onChange={(e) => setTam(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="input input-sm"
            style={{ width: "4.5rem" }}
            aria-label="Borradores por tanda"
          />
          <button type="button" className="btn btn-sm" disabled={pending} onClick={armar}>
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Layers size={14} />} Armar tanda
          </button>
        </div>
      )}
    </div>
  );
}

/** Panel de una tanda: nombre, imágenes, un cambio para todos y mandarla. */
export function TandaPanel({ lote, listos, onElegir }: { lote: Lote; listos: number; onElegir: () => void }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(lote.nombre);
  const [indicacion, setIndicacion] = useState("");
  const [cambiando, startCambio] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const [pending, start] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);

  const subir = async (fs: FileList) => {
    setSubiendo(true);
    for (const f of [...fs].slice(0, 3 - lote.imagenes.length)) {
      const fd = new FormData();
      fd.append("imagen", f);
      const r = await fetch(`/api/lotes/${lote.id}`, { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "No se pudo subir." }));
      if (r.error) toast(r.error, "error");
    }
    setSubiendo(false);
    if (archivo.current) archivo.current.value = "";
    router.refresh();
  };

  return (
    <section className={`card mb-6 px-5 py-4 transition-opacity ${cambiando ? "opacity-70" : ""}`} aria-label={`Tanda ${lote.nombre}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="-mx-1 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-base font-medium outline-none hover:border-line focus:border-line-strong focus:bg-surface"
          value={nombre}
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre.trim() !== lote.nombre && start(async () => { const r = await renombrarTanda(lote.id, nombre); if (r?.error) toast(r.error, "error"); })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Nombre de la tanda"
        />
        <span className="text-xs text-ink-3">{lote.borradores} borradores{lote.enviados ? ` · ${lote.enviados} enviados` : ""}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lote.imagenes.map((i) => (
          <span key={i.archivo} className="group relative block h-16 w-24 overflow-hidden rounded-md border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(lote.id, i.archivo)} alt={i.nombre} className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 flex rounded-full bg-black/55 p-0.5 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={() => start(async () => { await quitarImagenTanda(lote.id, i.archivo); })}
              aria-label={`Quitar ${i.nombre}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {lote.imagenes.length < 3 && (
          <>
            <input ref={archivo} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && void subir(e.target.files)} />
            <button type="button" className="flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-xs text-ink-3 hover:border-ink-3 hover:text-ink-2" disabled={subiendo} onClick={() => archivo.current?.click()}>
              {subiendo ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              Imagen
            </button>
          </>
        )}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = indicacion.trim();
          if (!t) return;
          startCambio(async () => {
            const r = await cambiarTanda(lote.id, t);
            if (r?.message) toast(r.message);
            if (r?.error) toast(r.error, "error");
            if (r?.ok) setIndicacion("");
          });
        }}
      >
        <input
          className="input input-sm flex-1"
          placeholder="Pídele un cambio a toda la tanda: menciona las fotos, asunto más corto…"
          value={indicacion}
          maxLength={1000}
          onChange={(e) => setIndicacion(e.target.value)}
          disabled={cambiando}
          aria-label="Cambio para toda la tanda"
        />
        <button type="submit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40" disabled={cambiando || !indicacion.trim()} aria-label="Aplicar a la tanda">
          {cambiando ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUp size={15} />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={pending}
          onClick={() => confirm(`¿Deshacer "${lote.nombre}"? Los borradores regresan a "Sin tanda".`) && start(async () => { await deshacerTanda(lote.id); })}
        >
          Deshacer tanda
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!listos} onClick={onElegir}>
          Elegir {listos} para mandar
        </button>
      </div>
    </section>
  );
}
