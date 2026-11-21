"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { suggestReply } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { TagChip, MailIcon, WhatsAppIcon, InstagramIcon } from "@/components/ui";
import type { HiloMensaje } from "@/app/api/respuestas/[id]/route";

type Detalle = {
  respuesta: { id: number; clasificacion: string; fecha: string | null; resumen: string; quien_respondio: string | null; en_copia: string | null; pide: string | null; sugerencia: string | null };
  envio: { asunto: string; para: string | null; enviado_en: string | null; tanda: string | null };
  prospecto: {
    id: number; nombre: string; lista: string; estado: string; score: number | null; lugar: string | null; tipo: string | null; comoCobra: string | null;
    siguiente: string | null; observacion: string | null; pegas: string | null; tamano: string | null;
    contactos: { canal: string; valor: string; estado: string; nota: string | null }[];
    etiquetas: { id: number; nombre: string; color: string }[];
  };
  hilo: HiloMensaje[];
  fuenteHilo: "gmail" | "local";
  avisoHilo: string | null;
};

const fecha = (s: string) => {
  if (!s) return "";
  const d = new Date(s.length <= 10 ? `${s}T12:00` : s);
  return isNaN(d.getTime()) ? s : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: s.length > 10 ? "2-digit" : undefined, minute: s.length > 10 ? "2-digit" : undefined });
};
const CANAL_ICON: Record<string, React.ReactNode> = { correo: <MailIcon size={14} />, whatsapp: <WhatsAppIcon size={14} />, instagram: <InstagramIcon size={14} /> };

export function ReplyDetailButton({ replyId, slug }: { replyId: number; slug: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [pending, start] = useTransition();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/respuestas/${replyId}`, { cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo cargar el detalle.");
      setData((await r.json()) as Detalle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [replyId]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => setData(null);
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  const sugerencia = data?.respuesta.sugerencia ?? null;
  const limpia = sugerencia?.replace(/\n?\[REVISAR\][\s\S]*$/, "").trim() ?? "";

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => {
          dialog.current?.showModal();
          void cargar();
        }}
      >
        Ver más detalles
      </button>
      <dialog
        ref={dialog}
        className="m-0 ml-auto h-dvh max-h-none w-[min(44rem,100vw)] max-w-none border-l border-line bg-bg p-0 text-ink backdrop:bg-black/20"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/95 px-6 py-4 backdrop-blur">
          <h2 className="truncate font-serif text-2xl">{data?.prospecto.nombre ?? "Detalle"}</h2>
          <button type="button" className="btn btn-quiet px-2" aria-label="Cerrar" onClick={() => dialog.current?.close()}>×</button>
        </div>

        {cargando && !data && <p className="px-6 py-8 text-sm text-ink-3">Cargando…</p>}
        {error && <p className="px-6 py-8 text-sm text-bad">{error}</p>}

        {data && (
          <div className="space-y-8 px-6 py-6">
            {/* Quién es */}
            <section className="card space-y-3 p-5 text-sm">
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-2">Quién es</h3>
              <div className="flex flex-wrap gap-1.5">{data.prospecto.etiquetas.map((t) => <TagChip key={t.id} nombre={t.nombre} color={t.color} />)}</div>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
                {data.respuesta.quien_respondio && (<><dt className="text-ink-2">Respondió</dt><dd>{data.respuesta.quien_respondio}</dd></>)}
                {data.respuesta.en_copia && (<><dt className="text-ink-2">En copia</dt><dd className="break-words">{data.respuesta.en_copia}</dd></>)}
                {data.prospecto.lugar && (<><dt className="text-ink-2">Dónde</dt><dd>{data.prospecto.lugar}</dd></>)}
                {data.prospecto.tipo && (<><dt className="text-ink-2">Qué es</dt><dd>{data.prospecto.tipo}</dd></>)}
                {data.prospecto.tamano && (<><dt className="text-ink-2">Tamaño</dt><dd>{data.prospecto.tamano}</dd></>)}
                {data.prospecto.comoCobra && (<><dt className="text-ink-2">Cómo cobra hoy</dt><dd>{data.prospecto.comoCobra}</dd></>)}
                {data.prospecto.siguiente && (<><dt className="text-ink-2">Siguiente edición</dt><dd>{data.prospecto.siguiente}</dd></>)}
                {data.prospecto.pegas && (<><dt className="text-ink-2">No prometer</dt><dd className="text-warn">{data.prospecto.pegas}</dd></>)}
              </dl>
              {data.prospecto.contactos.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {data.prospecto.contactos.map((c, i) => (
                    <li key={i} className={`flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs ${c.estado === "reboto" ? "text-bad line-through" : "text-ink-2"}`} title={c.nota ?? undefined}>
                      {CANAL_ICON[c.canal]} <span className="font-mono">{c.valor}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/proyectos/${slug}/prospectos?lista=${data.prospecto.lista}&todos=1`} className="inline-block text-xs text-accent underline-offset-4 hover:underline">
                Ver en prospectos
              </Link>
            </section>

            {/* Hilo */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-ink-2">Hilo</h3>
                <span className="text-xs text-ink-3">{data.fuenteHilo === "gmail" ? "desde Gmail" : "guardado en Prospector"}</span>
              </div>
              {data.avisoHilo && <p className="text-xs text-ink-3">{data.avisoHilo}</p>}
              <ol className="space-y-3">
                {data.hilo.map((h, i) => (
                  <li key={i} className={`rounded-xl border p-4 text-sm ${h.nuestro ? "ml-8 border-line bg-surface" : "mr-8 border-accent/30 bg-accent-soft/30"}`}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-ink">{h.nuestro ? "Nosotros" : h.de}</span>
                      <span className="text-ink-3">{fecha(h.fecha)}</span>
                    </div>
                    {(h.para || h.cc) && (
                      <p className="mb-2 break-words text-xs text-ink-3">
                        {h.para && <>Para: {h.para}</>}
                        {h.cc && <> · Cc: {h.cc}</>}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{h.cuerpo}</p>
                    {h.citado && <p className="mt-2 text-xs text-ink-3">(Se ocultó el texto citado de mensajes anteriores)</p>}
                  </li>
                ))}
              </ol>
            </section>

            {/* Respuesta sugerida */}
            <section className="card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-ink-2">Respuesta sugerida</h3>
                <div className="flex gap-2">
                  {sugerencia && <CopyButton text={limpia} />}
                  <button
                    type="button"
                    className={sugerencia ? "btn btn-quiet" : "btn btn-primary"}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await suggestReply(data.respuesta.id);
                        if (r?.error) setError(r.error);
                        await cargar();
                      })
                    }
                  >
                    {pending ? "Redactando…" : sugerencia ? "Otra versión" : "Sugerir respuesta"}
                  </button>
                </div>
              </div>
              {sugerencia ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {sugerencia.split(/(\[REVISAR\][\s\S]*)/).map((part, i) =>
                    part.startsWith("[REVISAR]") ? <mark key={i} className="suposicion mt-2 block">{part}</mark> : <span key={i}>{part}</span>,
                  )}
                </p>
              ) : (
                <p className="text-sm text-ink-2">
                  Redacta una respuesta corta, en el tono del prospecto, que solo afirma lo que está en la ficha de verdad. Se copia y se manda desde Gmail.
                </p>
              )}
            </section>
          </div>
        )}
      </dialog>
    </>
  );
}
