"use client";

import { confirmReply, recordReply, suggestReply, syncInbox } from "@/app/actions";
import { ActionButton, FormMessage, StatefulForm } from "@/components/client";

export function SuggestButton({ replyId }: { replyId: number }) {
  return (
    <ActionButton action={() => suggestReply(replyId)} className="btn" pendingLabel="Redactando…">
      Sugerir respuesta
    </ActionButton>
  );
}

const CLASIFICACIONES = [
  ["interesado", "Interesado"],
  ["acuse", "Lo pasaron a quien decide"],
  ["no_ahora", "No ahora"],
  ["no", "No"],
  ["rebote", "Rebote"],
  ["auto_respuesta", "Auto-respuesta"],
  ["vacia", "Respuesta vacía"],
  ["baja", "Pidió no ser contactado"],
  ["otro", "Otro"],
] as const;

export function ReplyForm({ options }: { options: { id: number; label: string }[] }) {
  return (
    <StatefulForm action={recordReply} className="card grid gap-3 p-5 sm:grid-cols-2">
      {(state, pending) => (
        <>
          <label className="sm:col-span-2">
            <span className="label">Correo enviado</span>
            <select name="messageId" className="select" required defaultValue="">
              <option value="" disabled>Elige a quién respondió…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Tipo</span>
            <select name="clasificacion" className="select" defaultValue="interesado">
              {CLASIFICACIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Qué pide</span>
            <select name="pide" className="select" defaultValue="nada">
              <option value="nada">Nada</option>
              <option value="info">Información</option>
              <option value="llamada">Llamada</option>
              <option value="reunion">Reunión</option>
            </select>
          </label>
          <label>
            <span className="label">Quién respondió (opcional)</span>
            <input name="quien" className="input" placeholder="Nombre y cargo" />
          </label>
          <label>
            <span className="label">Resumen</span>
            <input name="resumen" className="input" placeholder="Qué dijo, en una línea" required />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : "Registrar respuesta"}</button>
            <FormMessage state={state} />
          </div>
        </>
      )}
    </StatefulForm>
  );
}

export function SyncButton({ projectId }: { projectId: number }) {
  return (
    <ActionButton action={() => syncInbox(projectId)} className="btn btn-primary" pendingLabel="Revisando Gmail…">
      Revisar respuestas en Gmail
    </ActionButton>
  );
}

/** Confirmar o corregir una clasificación automática. */
export function ReviewReply({ replyId, actual }: { replyId: number; actual: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-warn">Clasificación automática:</span>
      <select
        className="select w-auto py-1 text-xs"
        defaultValue={actual}
        onChange={(e) => void confirmReply(replyId, e.target.value)}
        aria-label="Corregir clasificación"
      >
        {CLASIFICACIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ActionButton action={() => confirmReply(replyId, actual)} className="btn py-1 text-xs">Es correcta</ActionButton>
    </span>
  );
}
