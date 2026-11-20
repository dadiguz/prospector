import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listProspects, scoreLines } from "@/lib/queries";
import { all, get, json } from "@/lib/db";
import { readProfile } from "@/lib/profile";
import { mxn } from "@/lib/hook-formula";
import { firstPhone, waLink } from "@/lib/whatsapp";
import { render } from "@/lib/drafts";
import { PageTitle, Badge, Assumable, Empty, ESTADO_LABEL, TagChip, TagFilter } from "@/components/ui";
import { ProspectActions } from "./actions-client";
import { BulkBar, RowCheckbox } from "./bulk";
import { projectTags, tagsByProspect } from "@/lib/tags";

const LISTAS = [
  { key: "A", label: "A · Correo verificado" },
  { key: "B", label: "B · Más débiles" },
  { key: "solo_wa_ig", label: "Solo WhatsApp o Instagram" },
  { key: "descartado", label: "Descartados" },
] as const;

const FIELDS: [string, string][] = [
  ["tipo", "Qué es"],
  ["vende", "Cómo cobra hoy"],
  ["cobra", "Cómo cobra hoy"],
  ["evento_actual", "Evento actual"],
  ["ultima", "Última edición"],
  ["siguiente", "Siguiente edición"],
  ["asistentes", "Tamaño"],
  ["tamano", "Tamaño"],
  ["vimos", "Observación"],
  ["asunto", "Asunto propuesto"],
  ["saludo", "Saludo"],
  ["pegas", "Pegas y qué no prometer"],
  ["cuando_mandar", "Cuándo mandar"],
  ["idioma", "Idioma"],
  ["nota", "Nota"],
];

const str = (v: unknown) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));

async function ProspectosContent({ params, searchParams }: PageProps<"/proyectos/[slug]/prospectos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const project = await getProject(slug);
  if (!project) notFound();
  const tags = projectTags(project.id);
  const tagId = tags.some((t) => String(t.id) === sp.tag) ? Number(sp.tag) : null;
  const todos = sp.todos === "1";
  let lista = LISTAS.some((l) => l.key === sp.lista) ? (sp.lista as string) : "A";
  if (!sp.lista && tagId) {
    // Desde "Ver resultados": abrir la primera lista con prospectos de esa búsqueda.
    const { counts: c0 } = await listProspects(project.id, "A", false, tagId);
    lista = LISTAS.find((l) => (c0.find((x) => x.lista === l.key)?.total ?? 0) > 0)?.key ?? "A";
  }
  const { rows, counts } = await listProspects(project.id, lista, !todos && lista !== "descartado", tagId);
  const tagMap = tagsByProspect(rows.map((r) => r.id));
  const qs = (o: { lista?: string; todos?: boolean; tag?: number | null }) => {
    const p = new URLSearchParams();
    p.set("lista", o.lista ?? lista);
    if (o.todos ?? todos) p.set("todos", "1");
    const t = o.tag === undefined ? tagId : o.tag;
    if (t) p.set("tag", String(t));
    return `?${p}`;
  };
  const profile = readProfile();
  const waTpl = get<{ cuerpo: string }>("SELECT cuerpo FROM templates WHERE project_id = ? AND canal = 'whatsapp' LIMIT 1", project.id)?.cuerpo;
  const ids = rows.map((r) => r.id);
  const evidence = ids.length
    ? all<{ prospect_id: number; url: string; que_demuestra: string; cita: string | null; tipo: string }>(
        `SELECT prospect_id, url, que_demuestra, cita, tipo FROM evidence WHERE prospect_id IN (${ids.map(() => "?").join(",")})`, ...ids)
    : [];

  return (
    <>
      <PageTitle sub="Ordenados por probabilidad de respuesta. Abre una fila para ver la evidencia.">Prospectos</PageTitle>
      <TagFilter tags={tags} active={tagId} hrefFor={(id) => (id ? `?tag=${id}&todos=1` : qs({ tag: null }))} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {LISTAS.map((l) => {
          const c = counts.find((x) => x.lista === l.key);
          const n = l.key === "descartado" || todos ? c?.total ?? 0 : c?.pendientes ?? 0;
          return (
            <Link
              key={l.key}
              href={qs({ lista: l.key })}
              className={`btn ${lista === l.key ? "border-ink" : "btn-quiet"}`}
            >
              {l.label} <span className="text-ink-3">{n}</span>
            </Link>
          );
        })}
        {lista !== "descartado" && (
          <Link href={qs({ todos: !todos })} className="ml-auto text-sm text-ink-2 underline-offset-4 hover:underline">
            {todos ? "Solo por revisar" : "Ver también contactados"}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>
          {todos || lista === "descartado" ? "No hay prospectos en esta lista." : "Nada por revisar aquí. Lanza una búsqueda desde la página del proyecto."}
        </Empty>
      ) : (
        <>
        <BulkBar projectId={project.id} slug={project.slug} tagId={tagId} total={rows.length} />
        <ul className="card divide-y divide-line">
          {rows.map((r) => {
            const f = json<Record<string, unknown>>(r.ficha_json, {});
            const cifra = (f._cifra_calculada as number | null) ?? null;
            const dolor = str(f.vende ?? f.cobra ?? f.como_cobra_hoy);
            const est = ESTADO_LABEL[r.estado] ?? { label: r.estado, tone: "neutral" as const };
            const ev = evidence.filter((e) => e.prospect_id === r.id);
            const fuentes = [f.fuente, f.evidencia].flat().filter((u): u is string => typeof u === "string" && u.startsWith("http"));
            const phone = firstPhone(r.whatsapp ?? str(f.wa ?? f.tel));
            const waText =
              waTpl && profile
                ? render(waTpl, {
                    nombre: str(f.saludo).replace(/^Hola,?\s*/i, "").split(/[:(]/)[0].trim() || "qué tal",
                    mi_nombre: profile.nombre.split(" ")[0],
                    empresa_corta: profile.empresa,
                    observacion_corta: str(f.vimos ?? f.observacion).replace(/\.$/, "") || "Vi lo que hacen",
                  })
                : null;
            return (
              <li key={r.id}>
                <details className="group">
                  <summary className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-[#fcfbf8] sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto]">
                    <div className="flex min-w-0 items-start gap-3">
                      <RowCheckbox id={r.id} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.nombre}</div>
                        <div className="truncate text-xs text-ink-2">{[str(f.lugar) || r.ciudad, r.estado_mx].filter(Boolean).join(" · ") || "Sin ubicación"}</div>
                        {(tagMap.get(r.id) ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(tagMap.get(r.id) ?? []).map((t) => <TagChip key={t.id} nombre={t.nombre} color={t.color} />)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="hidden min-w-0 truncate text-sm text-ink-2 sm:block" title={dolor}>
                      {lista === "descartado" ? r.motivo_descarte : dolor || "—"}
                    </div>
                    <div className="hidden text-right text-sm sm:block">{cifra ? `unos ${mxn(cifra)}` : ""}</div>
                    <div className="flex items-center gap-2 justify-self-end">
                      {r.score != null && lista !== "descartado" && <span className="font-mono text-xs text-ink-3">{r.score}</span>}
                      <Badge tone={est.tone}>{est.label}</Badge>
                    </div>
                  </summary>
                  <div className="space-y-5 bg-[#fcfbf8] px-5 pb-6 pt-2 text-sm">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                      {r.correo && (
                        <>
                          <dt className="text-ink-2">Correo</dt>
                          <dd className="font-mono text-xs">{r.correo}</dd>
                        </>
                      )}
                      {FIELDS.filter(([k]) => str(f[k])).map(([k, label]) => (
                        <div key={k} className="contents">
                          <dt className="text-ink-2">{label}</dt>
                          <dd><Assumable text={str(f[k])} /></dd>
                        </div>
                      ))}
                    </dl>
                    {scoreLines(r.score_detalle_json).length > 0 && (
                      <div>
                        <p className="mb-1 text-ink-2">Por qué tiene {r.score} puntos</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {scoreLines(r.score_detalle_json).map((s) => (
                            <li key={s.clave}><Badge tone={s.peso < 0 ? "bad" : "neutral"}>{s.peso > 0 ? "+" : ""}{s.peso} {s.descripcion}</Badge></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(ev.length > 0 || fuentes.length > 0) && (
                      <div>
                        <p className="mb-1 text-ink-2">Evidencia</p>
                        <ul className="space-y-1">
                          {(ev.length ? ev : fuentes.map((raw) => ({ url: raw.split(/\s+/)[0], que_demuestra: raw.split(/\s+/).slice(1).join(" "), cita: null, tipo: "verificado" }))).map((e, i) => (
                            <li key={`${i}-${e.url}`} className="break-all">
                              <a href={e.url} target="_blank" rel="noreferrer noopener" className="text-accent underline-offset-4 hover:underline">{e.url}</a>
                              {e.que_demuestra && <span className="text-ink-2"> · {e.que_demuestra}</span>}
                              {e.tipo === "suposicion" && <mark className="suposicion ml-1">SUPOSICIÓN</mark>}
                              {e.cita && <blockquote className="mt-1 border-l-2 border-line-strong pl-3 text-ink-2">“{e.cita}”</blockquote>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <ProspectActions
                      prospectId={r.id}
                      canDraft={Boolean(r.correo) && ["investigado", "en_espera"].includes(r.estado) && lista !== "descartado"}
                      canDiscard={["investigado", "en_espera", "borrador"].includes(r.estado)}
                      waHref={phone && waText ? waLink(phone, waText) : null}
                      waText={phone ? waText : null}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </>
  );
}

export default function Prospectos(props: PageProps<"/proyectos/[slug]/prospectos">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <ProspectosContent {...props} />
    </Suspense>
  );
}
