"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mail, TriangleAlert, X } from "lucide-react";
import { sendViaGmail } from "@/app/actions";

type Item = { id: number; nombre: string; para: string | null };
type Estado = "pendiente" | "enviando" | "enviado" | "error" | "omitido";

/**
 * Envío con avance: manda los correos uno por uno y muestra cuál va saliendo.
 * Cubre la pantalla para que no se haga otra cosa mientras tanto; se puede detener después del actual.
 * Si uno falla (hilo previo, supresión…) se salta y sigue; al final dice por qué no salió cada uno.
 * Solo se detiene la tanda cuando el problema es de todos (tope diario, Gmail desconectado o con límite).
 */
export function SendingModal({ projectId, items, onClose, send = sendViaGmail }: { projectId: number; items: Item[]; onClose: (enviados: number) => void; send?: typeof sendViaGmail }) {
  const [estados, setEstados] = useState<Record<number, Estado>>({});
  const [motivos, setMotivos] = useState<Record<number, string>>({});
  const [paro, setParo] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [termino, setTermino] = useState(false);
  const detener = useRef(false);
  const [deteniendo, setDeteniendo] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    (async () => {
      let n = 0;
      for (const it of items) {
        if (detener.current) {
          setEstados((e) => ({ ...e, [it.id]: "omitido" }));
          continue;
        }
        setEstados((e) => ({ ...e, [it.id]: "enviando" }));
        const r = await send(projectId, [it.id], { verificar: n === 0 }).catch((e: Error) => ({ error: e.message }) as const);
        if (r && "error" in r && r.error) {
          // El servidor antepone el nombre; aquí ya va en la lista.
          const motivo = r.error.startsWith(`${it.nombre}: `) ? r.error.slice(it.nombre.length + 2) : r.error;
          if ("detener" in r && r.detener) {
            // Problema de toda la tanda: este y los que siguen quedan sin enviar.
            setEstados((e) => ({ ...e, [it.id]: "omitido" }));
            setParo(motivo);
            detener.current = true;
            continue;
          }
          setEstados((e) => ({ ...e, [it.id]: "error" }));
          setMotivos((m) => ({ ...m, [it.id]: motivo }));
          continue;
        }
        n++;
        if (n === 1 && r && "message" in r && r.message) setNota(r.message.replace(/^1 enviado\(s\) desde [^ ]+\. ?/, "") || null);
        setEstados((e) => ({ ...e, [it.id]: "enviado" }));
      }
      setTermino(true);
    })();
  }, [items, projectId, send]);

  const enviados = items.filter((i) => estados[i.id] === "enviado").length;
  const fallidos = items.filter((i) => estados[i.id] === "error");
  const sinEnviar = items.filter((i) => estados[i.id] === "omitido").length;
  const actual = items.find((i) => estados[i.id] === "enviando");
  const pct = Math.round(((enviados + (actual ? 0.5 : 0)) / items.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,30,29,0.35)] p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Enviando correos">
      <div className="card w-full max-w-md p-6 shadow-xl">
        {!termino ? (
          <>
            <div className="relative mx-auto mb-5 flex h-16 w-44 items-center justify-center overflow-hidden" aria-hidden>
              <span className="absolute inset-x-6 top-1/2 border-t border-dashed border-line-strong" />
              <Mail size={30} strokeWidth={1.6} className="mail-fly relative bg-surface text-accent" />
            </div>
            <p className="text-center font-medium">
              Enviando {Math.min(enviados + 1, items.length)} de {items.length}
            </p>
            <p className="mt-1 truncate text-center text-sm text-ink-2">{actual ? `${actual.nombre} · ${actual.para}` : "Preparando…"}</p>
          </>
        ) : (
          <div className="mb-2 text-center">
            <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${paro ? "bg-bad-soft text-bad" : fallidos.length ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
              {paro ? <X size={24} strokeWidth={2} /> : fallidos.length ? <TriangleAlert size={22} strokeWidth={2} /> : <Check size={24} strokeWidth={2} />}
            </span>
            <p className="font-medium">{enviados} de {items.length} enviado(s)</p>
            {paro && <p className="mt-1 text-sm text-bad">Se detuvo: {paro}{sinEnviar ? ` Quedaron ${sinEnviar} sin enviar.` : ""}</p>}
            {nota && enviados > 0 && <p className="mt-1 text-sm text-ink-2">{nota}</p>}
          </div>
        )}

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#f1efe8]">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${termino ? Math.round((enviados / items.length) * 100) : pct}%` }} />
        </div>

        {termino && fallidos.length > 0 && (
          <div className="mt-4 rounded-lg border border-line bg-bg px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-ink-2">No se enviaron ({fallidos.length})</p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm">
              {fallidos.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.nombre}</span>
                  <span className="block text-xs text-ink-2">{motivos[i.id]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Siguen en Borradores para que los revises.</p>
          </div>
        )}

        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm">
          {items.map((i) => {
            const e = estados[i.id] ?? "pendiente";
            return (
              <li key={i.id} className={`flex items-center gap-2 ${e === "pendiente" || e === "omitido" ? "text-ink-3" : ""}`}>
                <span className="flex w-4 justify-center">
                  {e === "enviado" ? <Check size={14} strokeWidth={2.2} className="text-ok" /> : e === "error" ? <X size={14} strokeWidth={2.2} className="text-bad" /> : e === "enviando" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : <span className="h-1 w-1 rounded-full bg-line-strong" />}
                </span>
                <span className="truncate">{i.nombre}</span>
                {e === "omitido" && <span className="text-xs">sin enviar</span>}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end">
          {termino ? (
            <button type="button" className="btn btn-primary" onClick={() => onClose(enviados)}>Listo</button>
          ) : (
            <button type="button" className="btn btn-quiet" disabled={deteniendo} onClick={() => { detener.current = true; setDeteniendo(true); }}>
              {deteniendo ? "Se detiene después de este…" : "Detener"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
