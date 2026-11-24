import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listReplies } from "@/lib/queries";
import { responseAnalysis } from "@/lib/analysis";
import { WhatsAppIcon, PageTitle, Section, Fold, Badge, Stat, Empty, CLASIF_LABEL, TagFilter } from "@/components/ui";
import { Info } from "@/components/info";
import { projectTags } from "@/lib/tags";
import { ReplyForm, SyncButton, ReviewReply } from "./client";
import { AgentReply } from "./agent";
import { BrochureButton, BrochurePanel } from "./brochure";
import { FollowupDays } from "./followup";
import { readSettings } from "@/lib/profile";
import { brochureListo } from "@/lib/brochure";
import { ReplyDetailButton } from "./detail";
import { lastSeen, esNuevo } from "@/lib/vistas";
import { SeenTracker } from "@/components/seen-tracker";
import { gmailStatus } from "@/lib/gmail/oauth";

const ORDER = ["interesado", "acuse", "otro", "no_ahora", "no", "baja", "rebote", "auto_respuesta", "vacia"];
const VISTAS = [
  { key: "con", label: "Con respuesta" },
  { key: "seguir", label: "Dar seguimiento" },
  { key: "sin", label: "Sin respuesta" },
  { key: "rebotes", label: "Rebotaron" },
] as const;
type Vista = (typeof VISTAS)[number]["key"];
const FILTROS: { key: string; label: string; clases: string[] }[] = [
  { key: "todas", label: "Todas", clases: [] },
  { key: "interesados", label: "Interesados", clases: ["interesado", "acuse"] },
  { key: "no_interesados", label: "No interesados", clases: ["no", "no_ahora", "baja"] },
  { key: "otras", label: "Otras", clases: ["auto_respuesta", "vacia", "otro"] },
];
const tabCls = (on: boolean) => `rounded-lg px-2.5 py-1 text-sm ${on ? "bg-surface font-medium text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink"}`;
const pillCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`;
const fecha = (f: string | null) => f && new Date(f + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const pct = (x: number) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;

async function RespuestasContent({ params, searchParams }: PageProps<"/proyectos/[slug]/respuestas">) {
  const { slug } = await params;
  const sp = await searchParams;
  const project = await getProject(slug);
  if (!project) notFound();
  const tags = projectTags(project.id);
  const tagId = tags.some((t) => String(t.id) === sp.tag) ? Number(sp.tag) : null;
  const { replies, sinRespuesta, retomar } = await listReplies(project.id, tagId);
  const desde = lastSeen(project.id, "respuestas");
  const nuevas = replies.filter((r) => esNuevo(r.creado_en, desde)).length;
  const a = responseAnalysis(project.id);
  const gmail = await gmailStatus();
  const sorted = [...replies].sort((x, y) => ORDER.indexOf(x.clasificacion) - ORDER.indexOf(y.clasificacion));
  const conRespuesta = sorted.filter((r) => r.clasificacion !== "rebote");
  const rebotes = replies.filter((r) => r.clasificacion === "rebote");
  const vista: Vista = VISTAS.some((v) => v.key === sp.vista) ? (sp.vista as Vista) : "con";
  const filtro = FILTROS.some((f) => f.key === sp.filtro) ? (sp.filtro as string) : "todas";
  const clases = FILTROS.find((f) => f.key === filtro)!.clases;
  const visibles = filtro === "todas" ? conRespuesta : conRespuesta.filter((r) => clases.includes(r.clasificacion));
  const diasSeg = readSettings().diasSeguimiento;
  const toca = sinRespuesta.filter((s) => s.dias >= diasSeg);
  const conteo: Record<Vista, number> = { con: conRespuesta.length, seguir: toca.length, sin: sinRespuesta.length, rebotes: rebotes.length };
  const itemSin = (s: (typeof sinRespuesta)[number]) => (
    <li key={s.message_id} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.nombre}</span>
            {s.canal === "whatsapp" && <span className="inline-flex items-center gap-1 text-xs text-ink-2"><WhatsAppIcon size={13} /> WhatsApp</span>}
            {vista === "sin" && s.dias >= diasSeg && <Badge tone="warn">Toca seguimiento</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink-3">{[s.canal === "whatsapp" && s.para ? s.para.replace(/^52(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3") : s.para, s.tanda, `hace ${s.dias} día${s.dias === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
        </div>
        {!s.seguimiento && <AgentReply tipo="seguimiento" id={s.message_id} sugerencia={null} />}
      </div>
      {s.seguimiento && <AgentReply tipo="seguimiento" id={s.message_id} sugerencia={s.seguimiento} waPhone={s.canal === "whatsapp" ? s.para : null} />}
    </li>
  );
  const qs = (cambio: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { vista: vista === "con" ? null : vista, filtro: filtro === "todas" ? null : filtro, tag: tagId ? String(tagId) : null, ...cambio };
    if (base.vista === "con") base.vista = null;
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <>
      <SeenTracker projectId={project.id} seccion="respuestas" />
      <div className="flex items-start justify-between gap-4">
        <PageTitle>Respuestas</PageTitle>
        <div className="pt-3"><TagFilter tags={tags} active={tagId} hrefFor={(id) => qs({ tag: id ? String(id) : null })} /></div>
      </div>
      {nuevas > 0 && <p className="-mt-3 mb-4 text-sm text-accent">{nuevas} nueva(s)</p>}
      <div className="mb-8 flex flex-wrap items-center gap-8">
        <Stat label="Enviados" value={a.total.enviados} />
        <Stat label="Positivos" value={a.total.positivos} tone="ok" />
        <Stat label="Rebotes" value={a.total.rebotes} tone="bad" />
        <Info label="Más cifras">
          Entregados: {a.total.entregados} · Negativos: {a.total.negativos}. El detalle por tanda y por atributo está en Análisis, al final.
        </Info>
      </div>

      <nav className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line pb-3">
        {VISTAS.map((v) => (
          <Link key={v.key} href={qs({ vista: v.key, filtro: null })} className={tabCls(vista === v.key)}>
            {v.label} <span className="text-ink-3">{conteo[v.key]}</span>
          </Link>
        ))}
        {gmail.conectado && <div className="ml-auto"><SyncButton projectId={project.id} /></div>}
      </nav>

      {vista === "con" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {FILTROS.map((f) => {
              const n = f.key === "todas" ? conRespuesta.length : conRespuesta.filter((r) => f.clases.includes(r.clasificacion)).length;
              return (
                <Link key={f.key} href={qs({ filtro: f.key === "todas" ? null : f.key })} className={pillCls(filtro === f.key)}>
                  {f.label} <span className="text-ink-3">{n}</span>
                </Link>
              );
            })}
          </div>
          {visibles.length === 0 ? (
            <Empty>{conRespuesta.length === 0 ? "Aún no hay respuestas." : "Nada con este filtro."}</Empty>
          ) : (
            <ul className="space-y-3">
              {visibles.map((r) => {
                const l = CLASIF_LABEL[r.clasificacion] ?? CLASIF_LABEL.otro;
                const nueva = esNuevo(r.creado_en, desde);
                const bro = brochureListo(r.prospect_id);
                return (
                  <li key={r.id} className={`card p-5 ${nueva ? "border-accent bg-accent-soft/20" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.nombre}</span>
                          {nueva && <span className="rounded-full bg-accent px-1.5 text-[10px] font-medium uppercase tracking-wide text-white">Nueva</span>}
                          <Badge tone={l.tone}>{l.label}</Badge>
                          {r.pide && r.pide !== "nada" && <Badge tone="accent">Pide {r.pide === "info" ? "información" : r.pide}</Badge>}
                        </div>
                        <p className="mt-1 text-sm">{r.resumen}</p>
                        <p className="mt-1 text-xs text-ink-3">{[r.quien_respondio, fecha(r.fecha), r.tanda].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReplyDetailButton replyId={r.id} slug={project.slug} />
                        {!r.sugerencia && <AgentReply tipo="respuesta" id={r.id} sugerencia={null} />}
                        <BrochureButton replyId={r.id} estado={bro} />
                      </div>
                    </div>
                    {!r.revisado_por_humano && <div className="mt-3"><ReviewReply replyId={r.id} actual={r.clasificacion} /></div>}
                    {r.sugerencia && <AgentReply tipo="respuesta" id={r.id} sugerencia={r.sugerencia} />}
                    <BrochurePanel replyId={r.id} prospectId={r.prospect_id} estado={bro} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {vista === "seguir" && (
        <>
          <div className="card mb-4 p-5">
            <h3 className="font-medium">Cómo dar seguimiento</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-2">
              <li>· Escríbeles en el mismo hilo del correo, no en uno nuevo.</li>
              <li>· Corto: tres a cinco líneas, con algo nuevo y una pregunta fácil de contestar.</li>
              <li>· Sin reclamar que no contestaron. Máximo dos seguimientos; después, se deja.</li>
            </ul>
            <div className="mt-4"><FollowupDays dias={diasSeg} /></div>
          </div>
          {toca.length === 0 ? (
            <Empty>Nadie lleva {diasSeg} días o más sin responder.</Empty>
          ) : (
            <ul className="space-y-3">{toca.map(itemSin)}</ul>
          )}
        </>
      )}

      {vista === "sin" && (
        sinRespuesta.length === 0 ? (
          <Empty>Todos los correos enviados tienen respuesta.</Empty>
        ) : (
          <ul className="space-y-3">{sinRespuesta.map(itemSin)}</ul>
        )
      )}

      {vista === "rebotes" && (
        rebotes.length === 0 ? (
          <Empty>Ningún correo ha rebotado.</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {rebotes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <span className="font-medium">{r.nombre}</span>
                  <p className="mt-0.5 text-xs text-ink-3">{[r.para, fecha(r.fecha), r.tanda].filter(Boolean).join(" · ")}</p>
                  {r.resumen && <p className="mt-1 text-sm text-ink-2">{r.resumen}</p>}
                </div>
                <ReplyDetailButton replyId={r.id} slug={project.slug} />
              </li>
            ))}
          </ul>
        )
      )}

      <div className="mt-10" />
      <Fold title="Registrar una respuesta a mano" open={!gmail.conectado && replies.length === 0}>
        <ReplyForm options={sinRespuesta.map((s) => ({ id: s.message_id, label: `${s.nombre}${s.para ? ` · ${s.para}` : ""}` }))} />
      </Fold>

      {retomar.length > 0 && (
        <Section title="Retomar">
          <ul className="space-y-1 text-sm">
            {retomar.map((r, i) => (
              <li key={i}>· <span className="font-medium">{r.nombre}</span>: {r.motivo}{r.fecha ? ` (${r.fecha})` : ""}</li>
            ))}
          </ul>
        </Section>
      )}

      <Fold title="Análisis">
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
        <p className="mt-2 flex items-center gap-1 text-xs text-ink-3">
          Cómo se calcula
          <Info>Los atributos de las tandas importadas se estimaron del texto de cada ficha. Un cambio de peso se propone solo con 20 entregados por valor y 3 positivos de diferencia.</Info>
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
