import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, listReplies } from "@/lib/queries";
import { responseAnalysis } from "@/lib/analysis";
import { PageTitle, Section, Fold, Badge, Stat, Empty, CLASIF_LABEL } from "@/components/ui";
import { ReplyForm, SuggestButton, SyncButton, ReviewReply } from "./client";
import { gmailStatus } from "@/lib/gmail/oauth";
import { CopyButton } from "@/components/client";

const ORDER = ["interesado", "acuse", "otro", "no_ahora", "no", "baja", "rebote", "auto_respuesta", "vacia"];
const pct = (x: number) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;

async function RespuestasContent({ params }: PageProps<"/proyectos/[slug]/respuestas">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const { replies, sinRespuesta, retomar } = await listReplies(project.id);
  const a = responseAnalysis(project.id);
  const gmail = await gmailStatus();
  const sorted = [...replies].sort((x, y) => ORDER.indexOf(x.clasificacion) - ORDER.indexOf(y.clasificacion));

  return (
    <>
      <PageTitle sub="Clasificadas por tipo, con una sugerencia de respuesta en el tono del prospecto.">Respuestas</PageTitle>

      <div className="card mb-10 grid grid-cols-2 gap-6 p-6 sm:grid-cols-5">
        <Stat label="Enviados" value={a.total.enviados} />
        <Stat label="Entregados" value={a.total.entregados} />
        <Stat label="Positivos" value={a.total.positivos} tone="ok" />
        <Stat label="Negativos" value={a.total.negativos} />
        <Stat label="Rebotes" value={a.total.rebotes} tone="bad" />
      </div>

      <Section title="Respuestas" aside={gmail.conectado ? <SyncButton projectId={project.id} /> : undefined}>
        {sorted.length === 0 ? (
          <Empty>Aún no hay respuestas registradas.</Empty>
        ) : (
          <ul className="space-y-3">
            {sorted.map((r) => {
              const l = CLASIF_LABEL[r.clasificacion] ?? CLASIF_LABEL.otro;
              const accionable = ["interesado", "acuse", "otro", "no_ahora"].includes(r.clasificacion);
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.nombre}</span>
                        <Badge tone={l.tone}>{l.label}</Badge>
                        {r.pide && r.pide !== "nada" && <Badge tone="accent">Pide {r.pide === "info" ? "información" : r.pide}</Badge>}
                      </div>
                      <p className="mt-1 text-sm">{r.resumen}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {[r.quien_respondio, r.fecha && new Date(r.fecha + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }), r.tanda].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {accionable && !r.sugerencia && <SuggestButton replyId={r.id} />}
                  </div>
                  {!r.revisado_por_humano && <div className="mt-3"><ReviewReply replyId={r.id} actual={r.clasificacion} /></div>}
                  {r.sugerencia && (
                    <div className="mt-4 rounded-lg border border-line bg-bg px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-ink-2">Sugerencia de respuesta</span>
                        <CopyButton text={r.sugerencia.replace(/\n?\[REVISAR\][\s\S]*$/, "").trim()} />
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {r.sugerencia.split(/(\[REVISAR\][\s\S]*)/).map((part, i) =>
                          part.startsWith("[REVISAR]") ? <mark key={i} className="suposicion block mt-2">{part}</mark> : <span key={i}>{part}</span>,
                        )}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Registrar una respuesta">
        <p className="mb-3 text-sm text-ink-2">{gmail.conectado ? "Para respuestas que llegaron por otro canal (teléfono, WhatsApp)." : "Mientras Gmail no esté conectado, registra aquí lo que conteste cada prospecto."}</p>
        <ReplyForm options={sinRespuesta.map((s) => ({ id: s.message_id, label: `${s.nombre}${s.para ? ` · ${s.para}` : ""}` }))} />
      </Section>

      {retomar.length > 0 && (
        <Section title="Retomar">
          <ul className="space-y-1 text-sm">
            {retomar.map((r, i) => (
              <li key={i}>· <span className="font-medium">{r.nombre}</span>: {r.motivo}{r.fecha ? ` (${r.fecha})` : ""}</li>
            ))}
          </ul>
        </Section>
      )}

      <Fold title={`Sin respuesta (${sinRespuesta.length})`}>
        <ul className="divide-y divide-line text-sm">
          {sinRespuesta.map((s) => (
            <li key={s.message_id} className="flex justify-between gap-4 py-1.5">
              <span className="truncate">{s.nombre}</span>
              <span className="whitespace-nowrap text-ink-2">{s.tanda} · hace {s.dias} días</span>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Análisis de respuestas" open>
        {a.avisos.length > 0 && (
          <ul className="mb-5 space-y-1 text-sm text-warn">
            {a.avisos.map((x) => <li key={x}>! {x}</li>)}
          </ul>
        )}
        <h3 className="mb-2 text-sm font-medium">Por tanda</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-left text-xs text-ink-2">
              <tr><th className="py-1 font-normal">Tanda</th><th className="font-normal">Enviados</th><th className="font-normal">Positivos</th><th className="font-normal">Negativos</th><th className="font-normal">Rebotes</th><th className="font-normal">Tasa</th></tr>
            </thead>
            <tbody>
              {a.tramos.map((t) => (
                <tr key={t.tanda} className="border-t border-line">
                  <td className="py-1.5">{t.tanda}{t.fresca && <span className="ml-1 text-xs text-warn">reciente</span>}</td>
                  <td>{t.enviados}</td>
                  <td className={t.positivos ? "text-ok" : ""}>{t.positivos}</td>
                  <td>{t.negativos}</td>
                  <td className={t.rebotes ? "text-bad" : ""}>{t.rebotes}</td>
                  <td>{t.entregados ? pct(t.positivos / t.entregados) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-2">
          Con enlaces en el cuerpo: {a.enlaces.con.positivos} de {a.enlaces.con.entregados} · sin enlaces: {a.enlaces.sin.positivos} de {a.enlaces.sin.entregados}.
        </p>

        <h3 className="mb-2 mt-8 text-sm font-medium">Por atributo (tasa suavizada)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-ink-2">
              <tr><th className="py-1 font-normal">Atributo</th><th className="font-normal">Valor</th><th className="font-normal">Entregados</th><th className="font-normal">Positivos</th><th className="font-normal">Tasa</th><th className="font-normal">Confianza</th></tr>
            </thead>
            <tbody>
              {a.atributos.map((x) => (
                <tr key={`${x.clave}-${x.valor}`} className="border-t border-line">
                  <td className="py-1.5 pr-3">{x.descripcion}</td>
                  <td>{x.valor ? "sí" : "no"}</td>
                  <td>{x.entregados}</td>
                  <td className={x.positivos ? "text-ok" : ""}>{x.positivos}</td>
                  <td title={`Cruda ${pct(x.tasa)}`}>{pct(x.suavizada)}</td>
                  <td><Badge tone={x.etiqueta === "con evidencia" ? "ok" : "neutral"}>{x.confianza} · {x.etiqueta}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Los atributos de las tandas importadas se estimaron del texto de cada ficha. Un cambio de peso se propone solo con 20 entregados por valor y 3 positivos de diferencia.
        </p>
        {a.propuestas.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm">
            {a.propuestas.map((p) => <li key={p.clave}>Propuesta: {p.descripcion}. {p.sugerencia}.</li>)}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink-2">Todavía no hay muestra suficiente para proponer cambios al scoring.</p>
        )}
      </Fold>
    </>
  );
}

export default function Respuestas(props: PageProps<"/proyectos/[slug]/respuestas">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <RespuestasContent {...props} />
    </Suspense>
  );
}
