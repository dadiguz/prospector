"use client";

import { useState, useTransition } from "react";
import { discardDraft, fixDrafts, markSent, pushDraftsToGmail, sendTestToMe, sendViaGmail, updateDraft, type FormState } from "@/app/actions";
import { ActionButton, CopyButton, FormMessage, StatefulForm } from "@/components/client";
import type { Issue } from "@/lib/validator";
import { Info } from "@/components/info";
import { ARREGLOS_AUTO } from "@/lib/fix-labels";

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
        <span className="flex items-center gap-2 text-ink-2">
          <span><strong className="font-medium text-ink">{listos.length}</strong> de {drafts.length} listos para mandar</span>
          <Info label="Envíos de hoy">Hoy llevas {props.enviadosHoy} de {props.tope} envíos (tope diario, en Ajustes). Un borrador está listo si tiene destinatario y no tiene errores.</Info>
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => setSel(sel.length ? [] : listos.map((d) => d.id).slice(0, restantes))}>
            {sel.length ? "Quitar selección" : "Elegir los listos"}
          </button>
          <button type="button" className="btn btn-primary" disabled={!sel.length} onClick={() => { setState(null); setConfirming(true); }}>
            Mandar {sel.length || ""}
          </button>
        </div>
      </div>

      <Problems projectId={props.projectId} drafts={drafts} />

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
          </span>
        </label>
        <div className="flex items-center gap-3">
          {warns.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-warn">
              {warns.length} aviso(s)
              <Info label="Avisos">
                {warns.map((i, k) => <span key={k} className="block">· {i.regla}: {i.detalle}</span>)}
                <span className="mt-1 block text-ink-3">Los avisos no impiden mandar.</span>
              </Info>
            </span>
          )}
          {(d.pegas || d.cuando) && (
            <span className="flex items-center gap-1 text-xs text-ink-2">
              Notas
              <Info label="Notas antes de mandar">
                {d.cuando && <span className="block">Cuándo mandar: {d.cuando}</span>}
                {d.pegas && <span className="mt-1 block">No prometer: {d.pegas}</span>}
              </Info>
            </span>
          )}
          <button type="button" className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Cerrar" : "Editar"}</button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {errors.map((i, k) => (
            <li key={`e${k}`} className="text-bad">✕ {i.regla}: {i.detalle}</li>
          ))}
        </ul>
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
      <div className="mt-3 flex flex-wrap justify-end gap-1 text-xs">
        <CopyButton text={d.asunto} label="Copiar asunto" className="btn btn-quiet" />
        <CopyButton text={d.cuerpo} label="Copiar cuerpo" className="btn btn-quiet" />
        {gmail && <ActionButton action={() => sendTestToMe(d.id)} className="btn btn-quiet" pendingLabel="Enviando…">Enviarme prueba</ActionButton>}
        <ActionButton action={() => discardDraft(d.id)} className="btn btn-quiet" confirm="¿Descartar este borrador?">Descartar</ActionButton>
      </div>
    </li>
  );
}

type Grupo = { regla: string; nivel: "error" | "aviso"; drafts: Draft[]; detalle: string };
const ASISTENTE = "asistente";
const DEJAR = "dejar";

/** Apartado "Problemas": un renglón por regla con la acción que eliges, y un solo botón para aplicar todo. */
function Problems({ projectId, drafts }: { projectId: number; drafts: Draft[] }) {
  const grupos: Grupo[] = [];
  for (const d of drafts)
    for (const i of d.issues) {
      let g = grupos.find((x) => x.regla === i.regla);
      if (!g) grupos.push((g = { regla: i.regla, nivel: i.nivel, drafts: [], detalle: i.detalle }));
      if (i.nivel === "error") g.nivel = "error";
      if (!g.drafts.includes(d)) g.drafts.push(d);
    }
  grupos.sort((a, b) => (a.nivel === b.nivel ? b.drafts.length - a.drafts.length : a.nivel === "error" ? -1 : 1));
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  if (!grupos.length) return null;
  const accion = (g: Grupo) => eleccion[g.regla] ?? (ARREGLOS_AUTO[g.regla] ? "auto" : ASISTENTE);
  const conAccion = grupos.filter((g) => accion(g) !== DEJAR);
  const afectados = new Set(grupos.flatMap((g) => g.drafts.map((d) => d.id))).size;

  const aplicar = () =>
    start(async () => {
      setState(null);
      const auto = conAccion.filter((g) => accion(g) === "auto").map((g) => ({ regla: g.regla, ids: g.drafts.map((d) => d.id) }));
      const ia = conAccion.filter((g) => accion(g) === ASISTENTE);
      if (auto.length) setState(await fixDrafts(projectId, auto));
      if (ia.length)
        window.dispatchEvent(
          new CustomEvent("asistente:pedir", {
            detail:
              "Arregla estos problemas de los borradores con la mejor propuesta, sin tocar lo demás:\n" +
              ia.map((g) => `- ${g.regla} (${g.drafts.map((d) => `${d.nombre} #${d.id}`).join(", ")})`).join("\n"),
          }),
        );
    });

  return (
    <section className="card mb-6 px-5 py-4" aria-label="Problemas">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Problemas en {afectados} borrador(es)</h2>
        <Info label="Cómo se arreglan">
          Elige qué hacer con cada problema y pulsa Arreglar. Los arreglos automáticos se aplican al momento. Los del asistente llegan como propuesta para que la revises antes de aplicarla. Los avisos no impiden mandar; los errores sí.
        </Info>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {grupos.map((g) => (
          <li key={g.regla} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={g.nivel === "error" ? "text-bad" : "text-warn"} aria-hidden>{g.nivel === "error" ? "✕" : "!"}</span>
              <span>{g.regla}</span>
              <span className="text-xs text-ink-3">{g.drafts.length === 1 ? g.drafts[0].nombre : `${g.drafts.length} borradores`}</span>
              <Info label={`Detalle: ${g.regla}`}>
                <span className="block">{g.detalle}</span>
                {g.drafts.length > 1 && <span className="mt-1 block text-ink-3">{g.drafts.map((d) => d.nombre).join(", ")}</span>}
              </Info>
            </span>
            <select
              className="select text-sm"
              style={{ width: "17rem" }}
              aria-label={`Acción para ${g.regla}`}
              value={accion(g)}
              onChange={(e) => setEleccion((x) => ({ ...x, [g.regla]: e.target.value }))}
            >
              {ARREGLOS_AUTO[g.regla] && <option value="auto">{ARREGLOS_AUTO[g.regla]}</option>}
              <option value={ASISTENTE}>Que lo arregle el asistente</option>
              <option value={DEJAR}>{g.nivel === "error" ? "Lo arreglo yo" : "Dejarlo así"}</option>
            </select>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <FormMessage state={state} />
        <button type="button" className="btn btn-primary" disabled={pending || !conAccion.length} onClick={aplicar}>
          {pending ? "Arreglando…" : `Arreglar ${conAccion.length === grupos.length ? "todo" : conAccion.length}`}
        </button>
      </div>
    </section>
  );
}
