"use client";

import { useState, useTransition } from "react";
import { archiveSegment, saveSegment } from "@/app/actions";
import { Field } from "@/components/wand-field";
import { More } from "@/components/info";
import { toast } from "@/components/toaster";
import { SearchForm } from "./search-form";
import { X } from "lucide-react";

export type SegmentData = { id: number; nombre: string; definicion: string; consultas: string[]; enviados: number; positivos: number; activos: number };

/** Tarjeta de un segmento: buscar, o editar nombre, definición y frases de búsqueda con la varita. */
export function SegmentCard({ projectId, seg, contexto, defaultBudget }: { projectId: number; seg: SegmentData; contexto: string; defaultBudget: number }) {
  const [editando, setEditando] = useState(false);
  return (
    <div className="card p-5">
      {editando ? (
        <SegmentEditor projectId={projectId} seg={seg} contexto={contexto} onDone={() => setEditando(false)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <h3 className="font-medium">
                {seg.nombre}
                {seg.enviados > 0 && (
                  <span className="ml-2 text-xs font-normal text-ink-3">
                    {seg.enviados} enviados · {seg.positivos} positivos
                  </span>
                )}
              </h3>
              <More lines={1} className="mt-0.5 text-sm text-ink-2">{seg.definicion}</More>
            </div>
            <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => setEditando(true)}>
              Editar
            </button>
          </div>
          <SearchForm segmentId={seg.id} segmento={seg.nombre} defaultBudget={defaultBudget} enCurso={seg.activos > 0} contexto={`${contexto}\nSegmento: ${seg.nombre}\n${seg.definicion}`} />
        </>
      )}
    </div>
  );
}

export function SegmentEditor({ projectId, seg, contexto, onDone }: { projectId: number; seg: SegmentData | null; contexto: string; onDone: () => void }) {
  const [nombre, setNombre] = useState(seg?.nombre ?? "");
  const [definicion, setDefinicion] = useState(seg?.definicion ?? "");
  const [consultas, setConsultas] = useState<string[]>(seg?.consultas.length ? seg.consultas : [""]);
  const [pending, start] = useTransition();
  const ctx = `${contexto}\nSegmento: ${nombre}\n${definicion}`;

  const guardar = () =>
    start(async () => {
      const r = await saveSegment(projectId, seg?.id ?? null, { nombre, definicion, consultas });
      if (r?.error) return toast(r.error, "error");
      toast(r?.message ?? "Guardado.");
      onDone();
    });

  return (
    <div className="space-y-3">
      <Field label="Nombre del segmento" value={nombre} onChange={setNombre} campo="segmento_nombre" contexto={ctx} placeholder="Tipo de prospecto + dolor" />
      <Field label="Definición" rows={3} value={definicion} onChange={setDefinicion} campo="segmento_definicion" contexto={ctx} hint="Tipo de prospecto, tamaño, dolor visible y territorio." />
      <div className="space-y-2">
        <span className="label">Frases de búsqueda</span>
        {consultas.map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Field
                label={`Búsqueda ${i + 1}`}
                value={c}
                onChange={(v) => setConsultas((xs) => xs.map((x, j) => (j === i ? v : x)))}
                campo="consulta"
                contexto={`${ctx}\nOtras búsquedas: ${consultas.filter((_, j) => j !== i).join(" | ")}`}
              />
            </div>
            <button type="button" className="btn btn-quiet btn-icon mt-6 " aria-label="Quitar búsqueda" onClick={() => setConsultas((xs) => xs.filter((_, j) => j !== i))}>
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-quiet text-sm" onClick={() => setConsultas((xs) => [...xs, ""])}>
          + Agregar búsqueda
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        {seg ? (
          <button
            type="button"
            className="btn btn-quiet text-sm text-bad"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("¿Archivar este segmento? Sus prospectos y búsquedas se conservan.")) return;
              start(async () => {
                const r = await archiveSegment(projectId, seg.id);
                if (r?.message) toast(r.message, "info");
              });
            }}
          >
            Archivar segmento
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet" onClick={onDone} disabled={pending}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={guardar} disabled={pending}>{pending ? "Guardando…" : seg ? "Guardar segmento" : "Agregar segmento"}</button>
        </div>
      </div>
    </div>
  );
}

/** Botón y formulario para agregar un segmento nuevo al final de la lista. */
export function NewSegment({ projectId, contexto }: { projectId: number; contexto: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button type="button" className="btn btn-quiet text-sm" onClick={() => setAbierto(true)}>
        + Agregar segmento
      </button>
    );
  return (
    <div className="card border-dashed p-5">
      <SegmentEditor projectId={projectId} seg={null} contexto={contexto} onDone={() => setAbierto(false)} />
    </div>
  );
}
