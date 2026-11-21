"use client";

import { useState, useTransition } from "react";
import { discardDraft, markSent, pushDraftsToGmail, sendTestToMe, sendViaGmail, updateDraft, type FormState } from "@/app/actions";
import { ActionButton, CopyButton, FormMessage, StatefulForm } from "@/components/client";
import type { Issue } from "@/lib/validator";
import { TagChip } from "@/components/ui";

type Draft = { id: number; nombre: string; para: string | null; asunto: string; cuerpo: string; issues: Issue[]; score: number | null; pegas: string | null; cuando: string | null; tags: { id: number; nombre: string; color: string }[]; nuevo?: boolean };

export function DraftsBoard(props: { projectId: number; drafts: Draft[]; remitente: string; gmailConectado: boolean; etiqueta: string; tope: number; enviadosHoy: number }) {
  const { drafts } = props;
  const listos = drafts.filter((d) => !d.issues.some((i) => i.nivel === "error") && d.para);
  const [sel, setSel] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const chosen = drafts.filter((d) => sel.includes(d.id));
  const restantes = Math.max(0, props.tope - props.enviadosHoy);
  const run = (fn: () => Promise<FormState>, clearOnOk = true) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (r?.ok && clearOnOk) { setSel([]); setConfirming(false); }
    });

  return (
    <>
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
        <span className="text-ink-2">
          {drafts.length} borradores · {listos.length} sin errores · hoy van {props.enviadosHoy} de {props.tope}
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => setSel(sel.length ? [] : listos.map((d) => d.id).slice(0, restantes))}>
            {sel.length ? "Quitar selección" : "Seleccionar los listos"}
          </button>
          <button type="button" className="btn btn-primary" disabled={!sel.length} onClick={() => { setState(null); setConfirming(true); }}>
            Mandar {sel.length || ""}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="card mb-6 border-accent p-5" role="dialog" aria-label="Confirmar envío">
          <h3 className="font-medium">Antes de mandar</h3>
          {props.gmailConectado ? (
            <p className="mt-1 text-sm text-ink-2">
              Se enviarán <strong>{chosen.length}</strong> correo(s) desde <strong>{props.remitente}</strong>, con tu firma de Gmail y la etiqueta “{props.etiqueta}”.
              Antes de cada uno se vuelve a revisar Gmail y la lista de supresión.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              Gmail no está conectado. Copia cada correo a Gmail desde <strong>{props.remitente}</strong>, con tu firma, y etiqueta el hilo
              “{props.etiqueta}”. Cuando estén enviados, regístralos aquí: se vuelve a revisar duplicados y lista de supresión.
            </p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {chosen.map((d) => (
              <li key={d.id}>· {d.nombre} <span className="font-mono text-xs text-ink-2">{d.para}</span></li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {props.gmailConectado ? (
              <>
                <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => sendViaGmail(props.projectId, chosen.map((d) => d.id)))}>
                  {pending ? "Enviando…" : `Mandar ${chosen.length} ahora`}
                </button>
                <button type="button" className="btn" disabled={pending} onClick={() => run(() => pushDraftsToGmail(props.projectId, chosen.map((d) => d.id)), false)}>
                  Solo dejarlos como borradores en Gmail
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => markSent(props.projectId, chosen.map((d) => d.id)))}>
                {pending ? "Registrando…" : `Ya los mandé: registrar ${chosen.length}`}
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>Volver</button>
          </div>
          <div className="mt-2"><FormMessage state={state} /></div>
        </div>
      )}
      {!confirming && <div className="mb-4"><FormMessage state={state} /></div>}

      <ul className="space-y-4">
        {drafts.map((d) => (
          <DraftCard key={d.id} d={d} gmail={props.gmailConectado} selected={sel.includes(d.id)} onToggle={() => setSel((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
        ))}
      </ul>
    </>
  );
}

function DraftCard({ d, gmail, selected, onToggle }: { d: Draft; gmail: boolean; selected: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const errors = d.issues.filter((i) => i.nivel === "error");
  const warns = d.issues.filter((i) => i.nivel === "aviso");
  return (
    <li className={`card p-5 ${selected || d.nuevo ? "border-accent" : ""} ${d.nuevo ? "bg-accent-soft/20" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex min-w-0 items-start gap-3">
          <input type="checkbox" checked={selected} onChange={onToggle} disabled={errors.length > 0 || !d.para} className="mt-1.5 accent-[var(--accent)]" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              {d.nombre}
              {d.nuevo && <span className="rounded-full bg-accent px-1.5 text-[10px] font-medium uppercase tracking-wide text-white">Nuevo</span>}
            </span>
            <span className="block font-mono text-xs text-ink-2">{d.para ?? "sin destinatario"}</span>
            {d.tags.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1">{d.tags.map((t) => <TagChip key={t.id} nombre={t.nombre} color={t.color} />)}</span>
            )}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={d.asunto} label="Copiar asunto" />
          <CopyButton text={d.cuerpo} label="Copiar cuerpo" />
          <button type="button" className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Cerrar" : "Editar"}</button>
        </div>
      </div>

      {(errors.length > 0 || warns.length > 0) && (
        <ul className="mt-4 space-y-1 text-sm">
          {errors.map((i, k) => <li key={`e${k}`} className="text-bad">✕ {i.regla}: {i.detalle}</li>)}
          {warns.map((i, k) => <li key={`w${k}`} className="text-warn">! {i.regla}: {i.detalle}</li>)}
        </ul>
      )}
      {(d.pegas || d.cuando) && (
        <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {d.cuando && <>Cuándo mandar: {d.cuando}. </>}
          {d.pegas && <>No prometer: {d.pegas}</>}
        </p>
      )}

      {editing ? (
        <StatefulForm action={updateDraft} className="mt-4 space-y-3">
          {(state, pending) => (
            <>
              <input type="hidden" name="id" value={d.id} />
              <input name="asunto" defaultValue={d.asunto} className="input" aria-label="Asunto" />
              <textarea name="cuerpo" defaultValue={d.cuerpo} rows={14} className="textarea" aria-label="Cuerpo" />
              <div className="flex items-center gap-3">
                <button className="btn btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
                <FormMessage state={state} />
              </div>
            </>
          )}
        </StatefulForm>
      ) : (
        <div className="mt-4 rounded-lg border border-line bg-bg px-4 py-3">
          <p className="text-sm font-medium">{d.asunto}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{d.cuerpo}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {gmail && <ActionButton action={() => sendTestToMe(d.id)} className="btn btn-quiet" pendingLabel="Enviando prueba…">Enviarme una prueba</ActionButton>}
        <ActionButton action={() => discardDraft(d.id)} className="btn btn-quiet" confirm="¿Descartar este borrador?">Descartar borrador</ActionButton>
      </div>
    </li>
  );
}
