import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, projectDetail } from "@/lib/queries";
import { json } from "@/lib/db";
import { hookFigure, mxn } from "@/lib/hook-formula";
import { readSettings } from "@/lib/profile";
import { PageTitle, Section, Fold, Badge } from "@/components/ui";
import { Info, More } from "@/components/info";
import { AutoRefresh, ActionButton } from "@/components/client";
import { cancelJob, repeatSearch } from "@/app/actions";
import { SegmentCard, NewSegment } from "./segment-card";

const JOB_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" | "accent" }> = {
  pendiente: { label: "En cola", tone: "neutral" },
  en_curso: { label: "Buscando", tone: "accent" },
  en_pausa: { label: "En pausa", tone: "warn" },
  hecho: { label: "Terminó", tone: "ok" },
  fallo: { label: "Falló", tone: "bad" },
  cancelado: { label: "Cancelada", tone: "neutral" },
};

async function ProjectPageContent({ params }: PageProps<"/proyectos/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const d = await projectDetail(project.id);
  const settings = readSettings();
  // Contexto para la varita: lo esencial del proyecto, sin datos de prospectos.
  const contextoWand = `Proyecto: ${project.nombre}\nPropuesta de valor: ${project.propuesta_valor}\nPerfil: ${d.weights.map((w) => `${w.descripcion} (${w.peso})`).join("; ")}`;
  const activeJob = d.jobs.some((j) => ["pendiente", "en_curso", "en_pausa"].includes(j.estado));
  const si = d.facts.filter((f) => f.tipo === "si_afirmar");
  const no = d.facts.filter((f) => f.tipo === "no_afirmar" || f.tipo === "no_mencionar");
  const pend = d.facts.filter((f) => f.tipo === "pendiente");

  const recientes = d.jobs.slice(0, 3);

  return (
    <>
      {activeJob && <AutoRefresh seconds={5} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle sub={<More lines={2}>{project.idea}</More>}>{project.nombre}</PageTitle>
        <div className="flex gap-2">
          <Link href={`/proyectos/${project.slug}/editar`} className="btn">Editar</Link>
          <a href={`/api/proyectos/${project.slug}/exportar`} className="btn btn-quiet" title="Descarga la configuración del proyecto (sin prospectos ni datos personales)">Exportar</a>
        </div>
      </div>

      <Section title="Buscar prospectos" id="buscar">
        <div className="space-y-3">
          {d.segments.map((s) => (
            <SegmentCard
              key={s.id}
              projectId={project.id}
              seg={{ id: s.id, nombre: s.nombre, definicion: s.definicion, consultas: json<string[]>(s.consultas_json, []), enviados: s.enviados, positivos: s.positivos, activos: s.activos }}
              contexto={contextoWand}
              defaultBudget={settings.presupuestoBusquedaUsd}
            />
          ))}
          <NewSegment projectId={project.id} contexto={contextoWand} />
        </div>
      </Section>

      {recientes.length > 0 && (
        <Section title="Búsquedas recientes">
          <ul className="card divide-y divide-line">
            {recientes.map((j) => {
              const l = JOB_LABEL[j.estado] ?? JOB_LABEL.pendiente;
              const activa = ["pendiente", "en_curso", "en_pausa"].includes(j.estado);
              const ultimo = ultimaActividad(j.actividad_json);
              return (
                <li key={j.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Badge tone={l.tone}>{l.label}</Badge>
                    <span className="min-w-0 flex-1 truncate">{j.etiqueta.replace(/^Búsqueda\s*/, "")}</span>
                    <Info label="Detalles de la búsqueda">
                      <span className="block">{j.hechos}/{j.pasos} pasos · US${j.costo.toFixed(2)}</span>
                      {j.mensaje && <span className="mt-1 block">{j.mensaje}</span>}
                      {j.estado === "en_pausa" && j.reanudar_despues && (
                        <span className="mt-1 block">Reanuda a las {new Date(j.reanudar_despues).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.</span>
                      )}
                      {ultimo && !activa && <span className="mt-1 block text-ink-3">Último paso: {ultimo}</span>}
                    </Info>
                    {j.tag_id && j.encontrados > 0 && (
                      <Link href={`/proyectos/${project.slug}/prospectos?tag=${j.tag_id}&todos=1`} className="text-accent underline-offset-4 hover:underline">
                        {j.encontrados} encontrados
                      </Link>
                    )}
                    {activa ? (
                      <ActionButton action={cancelJob.bind(null, j.id)} className="btn btn-quiet btn-sm" confirm="¿Cancelar esta búsqueda? Lo encontrado se queda.">
                        Cancelar
                      </ActionButton>
                    ) : (
                      <ActionButton
                        action={repeatSearch.bind(null, j.id)}
                        className="btn btn-quiet btn-sm"
                        pendingLabel="Iniciando…"
                        confirm={activeJob ? undefined : "¿Buscar de nuevo con lo mismo? No se repiten los que ya tienes."}
                      >
                        Repetir
                      </ActionButton>
                    )}
                  </div>
                  {j.estado === "en_curso" && ultimo && (
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-2">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                      <span className="truncate">{ultimo}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Configuración del proyecto">
        <Fold title="Propuesta de valor">
          <p className="max-w-3xl leading-relaxed">{project.propuesta_valor}</p>
          <p className="mt-2 text-sm text-ink-2">Meta: {project.meta_actual} · Cuenta como cliente: {project.conversion}</p>
        </Fold>
        <Fold title={<>Qué se puede decir del producto <span className="text-ink-3">· {si.length} sí, {no.length} no</span></>}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ok">Se puede afirmar</h3>
              <ul className="space-y-1.5 text-sm">
                {si.map((f) => (
                  <li key={f.id} title={f.evidencia}>· {f.afirmacion}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-bad">No afirmar</h3>
              <ul className="space-y-1.5 text-sm">
                {no.map((f) => (
                  <li key={f.id}>· {f.afirmacion}</li>
                ))}
              </ul>
              {pend.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-sm font-medium text-warn">Por confirmar</h3>
                  <ul className="space-y-1.5 text-sm">
                    {pend.map((f) => (
                      <li key={f.id}>· {f.afirmacion}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </Fold>
        {d.hooks.map((h) => (
          <Fold key={h.id} title={`Gancho: ${h.nombre}`}>
            <p className="text-sm text-ink-2">“{h.frase.replace("{cifra}", "$X")}”</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[500, 1200, 2500, 4000].map((p) => {
                const c = hookFigure(h.formula, p, h.multiplicador, h.redondeo);
                return (
                  <span key={p} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs">
                    {mxn(p)} → <strong className="font-medium">{c ? mxn(c) : "—"}</strong>
                  </span>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-xs text-ink-3">{h.formula}</p>
            <ul className="mt-1 space-y-1 text-xs text-ink-2">
              {json<string[]>(h.supuestos_json, []).map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </Fold>
        ))}
        <Fold title="Descartar automáticamente">
          <ul className="space-y-1.5 text-sm">
            {d.disqualifiers.map((q) => (
              <li key={q.regla}>
                <Badge tone={q.tipo === "duro" ? "bad" : "warn"}>{q.tipo === "duro" ? "siempre" : "revisar"}</Badge> {q.regla}
              </li>
            ))}
          </ul>
        </Fold>
        <Fold title="Qué hace mejor a un prospecto">
          <table className="w-full text-sm">
            <tbody>
              {d.weights.map((w) => (
                <tr key={w.clave} className="border-b border-line last:border-0">
                  <td className="py-1.5">{w.descripcion}</td>
                  <td className={`py-1.5 text-right font-mono ${w.peso < 0 ? "text-bad" : ""}`}>{w.peso > 0 ? `+${w.peso}` : w.peso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Fold>
        {d.territory && (
          <Fold title="Territorio">
            <p className="text-sm">Todo México excepto: {json<string[]>(d.territory.excluidos_json, []).join(", ")}.</p>
            {json<string[]>(d.territory.excepciones_json, []).length > 0 && (
              <p className="mt-1 text-sm text-ink-2">Excepciones: {json<string[]>(d.territory.excepciones_json, []).join(", ")}</p>
            )}
          </Fold>
        )}
      </Section>
    </>
  );
}

export default function ProjectPage(props: PageProps<"/proyectos/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <ProjectPageContent {...props} />
    </Suspense>
  );
}

/** La última acción de una búsqueda, en una línea. */
function ultimaActividad(raw: string): string | null {
  const items = json<{ t: string; texto: string }[]>(raw, []);
  return items.length ? items[items.length - 1].texto : null;
}
