"use client";

import { useState } from "react";
import { createDraft, discardProspect, postponeProspect } from "@/app/actions";
import { ActionButton, CopyButton } from "@/components/client";

export function ProspectActions({
  prospectId,
  canDraft,
  canDiscard,
  waHref,
  waText,
}: {
  prospectId: number;
  canDraft: boolean;
  canDiscard: boolean;
  waHref: string | null;
  waText: string | null;
}) {
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
      {canDraft && (
        <ActionButton action={() => createDraft(prospectId)} className="btn btn-primary" pendingLabel="Creando…">
          Crear borrador
        </ActionButton>
      )}
      {waHref && (
        <>
          <a href={waHref} target="_blank" rel="noreferrer noopener" className="btn">Abrir WhatsApp</a>
          {waText && <CopyButton text={waText} label="Copiar mensaje" />}
        </>
      )}
      {canDiscard && (
        <>
          <span className="flex items-center gap-2">
            <input type="date" className="input w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha para retomar" />
            <ActionButton action={() => postponeProspect(prospectId, fecha)} className="btn btn-quiet">Más tarde</ActionButton>
          </span>
          <span className="flex items-center gap-2">
            <input className="input w-48" placeholder="Motivo del descarte" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <ActionButton action={() => discardProspect(prospectId, motivo)} className="btn btn-quiet">Descartar</ActionButton>
          </span>
        </>
      )}
    </div>
  );
}
