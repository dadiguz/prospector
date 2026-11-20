import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, projectDetail } from "@/lib/queries";
import { json } from "@/lib/db";
import { hookFigure, mxn } from "@/lib/hook-formula";
import { readSettings } from "@/lib/profile";
import { PageTitle, Section, Fold, Badge, TagChip } from "@/components/ui";
import { AutoRefresh, ActionButton } from "@/components/client";
import { cancelJob } from "@/app/actions";
import { SearchForm } from "./search-form";

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
  const activeJob = d.jobs.some((j) => ["pendiente", "en_curso", "en_pausa"].includes(j.estado));
  const si = d.facts.filter((f) => f.tipo === "si_afirmar");
  const no = d.facts.filter((f) => f.tipo === "no_afirmar" || f.tipo === "no_mencionar");
  const pend = d.facts.filter((f) => f.tipo === "pendiente");

  return (
    <>
      {activeJob && <AutoRefresh seconds={5} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle sub={project.idea}>{project.nombre}</PageTitle>
        <div className="flex gap-2">
          <Link href={`/proyectos/${project.slug}/editar`} className="btn">Editar</Link>
          <a href={`/api/proyectos/${project.slug}/exportar`} className="btn btn-quiet" title="Configuración del proyecto, sin prospectos ni datos personales">Exportar .md</a>
        </div>
      </div>

      <Section title="Propuesta de valor">
        <p className="max-w-3xl text-[17px] leading-relaxed">{project.propuesta_valor}</p>
        <p className="mt-3 text-sm text-ink-2">
          Métrica principal: {project.metrica_principal} · Conversión: {project.conversion} · Meta: {project.meta_actual}
        </p>
      </Section>

      <Section title="Buscar prospectos">
        {d.jobs.length > 0 && (
          <ul className="mb-5 space-y-2">
            {d.jobs.map((j) => {
              const l = JOB_LABEL[j.estado] ?? JOB_LABEL.pendiente;
              return (
                <li key={j.id} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={l.tone}>{l.label}</Badge>
                      <span className="truncate">{j.etiqueta}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-2">
                      {j.hechos}/{j.pasos} pasos · {j.a} en lista A · US${j.costo.toFixed(2)} estimado
                      {j.mensaje ? ` · ${j.mensaje}` : ""}
                      {j.estado === "en_pausa" && j.reanudar_despues ? ` Reanuda a las ${new Date(j.reanudar_despues).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.` : ""}
                    </p>
                  </div>
                  <Activity json={j.actividad_json} live={j.estado === "en_curso"} />
                  {j.tag_id && j.encontrados > 0 && (
                    <Link href={`/proyectos/${project.slug}/prospectos?tag=${j.tag_id}&todos=1`} className="flex items-center gap-2 text-sm">
                      <TagChip nombre={j.tag_nombre ?? "Resultados"} color={j.tag_color ?? "pizarra"} count={j.encontrados} />
                      <span className="text-accent underline-offset-4 hover:underline">Ver resultados</span>
                    </Link>
                  )}
                  {["pendiente", "en_curso", "en_pausa"].includes(j.estado) && (
                    <ActionButton action={cancelJob.bind(null, j.id)} className="btn btn-quiet" confirm="¿Cancelar esta búsqueda? Lo encontrado se queda.">
                      Cancelar
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="space-y-3">
          {d.segments.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <h3 className="font-medium">{s.nombre}</h3>
                  <p className="mt-1 text-sm text-ink-2">{s.definicion}</p>
                  {s.enviados > 0 && (
                    <p className="mt-2 text-xs text-ink-3">
                      {s.enviados} enviados · {s.positivos} positivos
                    </p>
                  )}
                </div>
                <SearchForm segmentId={s.id} defaultBudget={settings.presupuestoBusquedaUsd} disabled={activeJob} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Ficha de verdad del producto">
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
                <h3 className="mb-2 mt-5 text-sm font-medium text-warn">Pendiente de confirmar</h3>
                <ul className="space-y-1.5 text-sm">
                  {pend.map((f) => (
                    <li key={f.id}>· {f.afirmacion}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Gancho">
        {d.hooks.map((h) => (
          <div key={h.id}>
            <p className="text-sm">
              {h.nombre}: <span className="text-ink-2">“{h.frase.replace("{cifra}", "$X")}”</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[500, 1200, 2500, 4000].map((p) => {
                const c = hookFigure(h.formula, p, h.multiplicador, h.redondeo);
                return (
                  <span key={p} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                    Precio de {mxn(p)} → <strong className="font-medium">unos {c ? mxn(c) : "—"}</strong> por cada {h.multiplicador}
                  </span>
                );
              })}
            </div>
            <Fold title="Fórmula y supuestos">
              <p className="font-mono text-xs">{h.formula}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                {json<string[]>(h.supuestos_json, []).map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
              {h.condicion && <p className="mt-2 text-sm text-ink-2">Usar si: {h.condicion}</p>}
            </Fold>
          </div>
        ))}
      </Section>

      <Fold title="Descalificadores">
        <ul className="space-y-1.5 text-sm">
          {d.disqualifiers.map((q) => (
            <li key={q.regla}>
              <Badge tone={q.tipo === "duro" ? "bad" : "warn"}>{q.tipo}</Badge> {q.regla}
              {q.origen && <span className="text-ink-3"> · {q.origen}</span>}
            </li>
          ))}
        </ul>
      </Fold>
      <Fold title="Pesos del perfil (scoring)">
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
        <p className="mt-2 text-xs text-ink-3">Son hipótesis hasta que haya respuestas suficientes. Los cambios se proponen desde Respuestas y se aprueban a mano.</p>
      </Fold>
      {d.territory && (
        <Fold title="Territorio">
          <p className="text-sm">Todo México excepto: {json<string[]>(d.territory.excluidos_json, []).join(", ")}.</p>
          <p className="mt-1 text-sm text-ink-2">{d.territory.motivo}</p>
          {json<string[]>(d.territory.excepciones_json, []).length > 0 && (
            <p className="mt-1 text-sm text-ink-2">Excepciones: {json<string[]>(d.territory.excepciones_json, []).join(", ")}</p>
          )}
        </Fold>
      )}
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

/** Lo que la búsqueda está haciendo: la última acción destacada y las anteriores tenues. */
function Activity({ json: raw, live }: { json: string; live: boolean }) {
  const items = json<{ t: string; texto: string }[]>(raw, []);
  if (!items.length) return null;
  const hora = (t: string) => new Date(t).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const esPaso = (t: string) => /^(Investigando a|Buscando candidatos)/.test(t);
  const paso = [...items].reverse().find((a) => esPaso(a.texto));
  const feed = items.filter((a) => !esPaso(a.texto)).reverse().slice(0, live ? 5 : 1);
  return (
    <div className="order-last w-full border-t border-line pt-2 text-xs">
      {paso && (
        <p className="flex items-center gap-2 font-medium text-ink">
          {live && <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
          <span className="truncate">{live ? paso.texto : `Último paso: ${paso.texto}`}</span>
        </p>
      )}
      {feed.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {feed.map((a, i) => (
            <li key={i} className={`flex gap-2 ${i === 0 ? "text-ink-2" : "text-ink-3"}`}>
              <span className="truncate">{a.texto}</span>
              <span className="ml-auto shrink-0">{hora(a.t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
