"use client";

import { useState } from "react";
import { createDraft, discardProspect, markWhatsappSent, postponeProspect } from "@/app/actions";
import { ActionButton, CopyButton } from "@/components/client";

export function ProspectActions({
  prospectId,
  canDraft,
  canDiscard,
  waHref,
  waText,
  waPhone,
  canMarkWa,
}: {
  prospectId: number;
  canDraft: boolean;
  canDiscard: boolean;
  waHref: string | null;
  waText: string | null;
  waPhone?: string | null;
  canMarkWa?: boolean;
}) {
  const [abrio, setAbrio] = useState(false);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [abierto, setAbierto] = useState<"tarde" | "descartar" | null>(null);
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {canDraft && (
          <ActionButton action={() => createDraft(prospectId)} className="btn btn-primary" pendingLabel="Creando…">
            Crear borrador
          </ActionButton>
        )}
        {waHref && (
          <>
            <a href={waHref} target="_blank" rel="noreferrer noopener" className="btn" onClick={() => setAbrio(true)}>Abrir WhatsApp</a>
            {waText && <CopyButton text={waText} label="Copiar mensaje" />}
            {canMarkWa && waText && waPhone && (
              <ActionButton action={() => markWhatsappSent(prospectId, waText, waPhone)} className={abrio ? "btn btn-primary" : "btn"} pendingLabel="Guardando…">
                Ya lo mandé
              </ActionButton>
            )}
          </>
        )}
        {canDiscard && (
          <span className="ml-auto flex gap-1">
            <button type="button" className={`btn btn-quiet ${abierto === "tarde" ? "border-ink" : ""}`} onClick={() => setAbierto(abierto === "tarde" ? null : "tarde")}>Más tarde</button>
            <button type="button" className={`btn btn-quiet ${abierto === "descartar" ? "border-ink" : ""}`} onClick={() => setAbierto(abierto === "descartar" ? null : "descartar")}>Descartar</button>
          </span>
        )}
      </div>
      {abierto === "tarde" && (
        <div className="flex items-center justify-end gap-2">
          <input type="date" className="input w-44" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Retomar el" />
          <ActionButton action={() => postponeProspect(prospectId, fecha)} className="btn">Guardar</ActionButton>
        </div>
      )}
      {abierto === "descartar" && (
        <div className="flex items-center justify-end gap-2">
          <input className="input w-64" placeholder="¿Por qué? (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <ActionButton action={() => discardProspect(prospectId, motivo)} className="btn">Descartar</ActionButton>
        </div>
      )}
    </div>
  );
}
