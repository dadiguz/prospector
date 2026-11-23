import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listProspects, scoreLines } from "@/lib/queries";
import { all, get, json } from "@/lib/db";
import { readProfile } from "@/lib/profile";
import { mxn } from "@/lib/hook-formula";
import { firstPhone, waLink } from "@/lib/whatsapp";
import { render } from "@/lib/drafts";
import { PageTitle, Badge, Assumable, Empty, ESTADO_LABEL, TagChip, TagFilter, MailIcon, WhatsAppIcon, InstagramIcon } from "@/components/ui";
import type { Canal } from "@/lib/queries";
import { ProspectActions } from "./actions-client";
import { BulkBar, RowCheckbox } from "./bulk";
import { projectTags, tagsByProspect } from "@/lib/tags";
import { lastSeen, esNuevo } from "@/lib/vistas";
import { SeenTracker } from "@/components/seen-tracker";
import { Info } from "@/components/info";

const LISTAS = [
  { key: "A", label: "Lista A" },
  { key: "B", label: "Lista B" },
  { key: "solo_wa_ig", label: "Sin correo" },
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
  const canal: Canal | null = sp.canal === "correo" || sp.canal === "whatsapp" ? sp.canal : null;
  let lista = LISTAS.some((l) => l.key === sp.lista) ? (sp.lista as string) : "A";
  if (!sp.lista && tagId) {
    // Desde "Ver resultados": abrir la primera lista con prospectos de esa búsqueda.
    const { counts: c0 } = await listProspects(project.id, "A", false, tagId, canal);
    lista = LISTAS.find((l) => (c0.find((x) => x.lista === l.key)?.total ?? 0) > 0)?.key ?? "A";
  }
  const { rows, counts, canales } = await listProspects(project.id, lista, !todos && lista !== "descartado", tagId, canal);
  const tagMap = tagsByProspect(rows.map((r) => r.id));
  const desde = lastSeen(project.id, "prospectos");
  const nuevos = rows.filter((r) => esNuevo(r.creado_en, desde)).length;
  const qs = (o: { lista?: string; todos?: boolean; tag?: number | null; canal?: Canal | null }) => {
    const p = new URLSearchParams();
    p.set("lista", o.lista ?? lista);
    if (o.todos ?? todos) p.set("todos", "1");
    const t = o.tag === undefined ? tagId : o.tag;
    if (t) p.set("tag", String(t));
    const c = o.canal === undefined ? canal : o.canal;
    if (c) p.set("canal", c);
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
      <SeenTracker projectId={project.id} seccion="prospectos" />
      <PageTitle>Prospectos</PageTitle>
      {nuevos > 0 && <p className="-mt-3 mb-4 text-sm text-accent">{nuevos} nuevo(s)</p>}
      <div className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line pb-3">
        {LISTAS.map((l) => {
          const c = counts.find((x) => x.lista === l.key);
          const n = l.key === "descartado" || todos ? c?.total ?? 0 : c?.pendientes ?? 0;
          return (
            <Link
              key={l.key}
              href={qs({ lista: l.key })}
              className={`rounded-lg px-2.5 py-1 text-sm ${lista === l.key ? "bg-surface font-medium text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink"}`}
            >
              {l.label} <span className="text-ink-3">{n}</span>
            </Link>
          );
        })}
        <Info label="Qué es cada lista" className="ml-1">
          <b className="font-medium text-ink">Lista A:</b> correo verificado y buen perfil. <b className="font-medium text-ink">Lista B:</b> perfil más débil o correo dudoso.{" "}
          <b className="font-medium text-ink">Sin correo:</b> solo WhatsApp o Instagram. El número cuenta los que faltan por revisar.
        </Info>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {([
            ["correo", "Con correo", <MailIcon key="m" size={14} />, canales.correo],
            ["whatsapp", "Con WhatsApp", <WhatsAppIcon key="w" size={14} />, canales.whatsapp],
          ] as const).map(([k, label, icon, n]) => (
            <Link
              key={k}
              href={qs({ canal: canal === k ? null : k })}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${canal === k ? "border-ink bg-surface text-ink" : "border-line-strong text-ink-2 hover:bg-[#efede5]"}`}
              title={canal === k ? "Quitar filtro" : label}
            >
              {icon} <span className="text-ink-3">{n}</span>
            </Link>
          ))}
          <TagFilter tags={tags} active={tagId} hrefFor={(id) => (id ? `?tag=${id}&todos=1${canal ? `&canal=${canal}` : ""}` : qs({ tag: null }))} />
          {lista !== "descartado" && (
            <Link href={qs({ todos: !todos })} className="ml-1 text-xs text-ink-3 underline-offset-4 hover:text-ink hover:underline">
              {todos ? "Solo por revisar" : "Ver todos"}
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty>
          {todos || lista === "descartado" ? "No hay prospectos en esta lista." : "Nada por revisar aquí. Busca prospectos desde Resumen."}
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
              <li key={r.id} className={esNuevo(r.creado_en, desde) ? "border-l-2 border-accent bg-accent-soft/30" : ""}>
                <details className="group">
                  <summary className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#fcfbf8]">
                    <RowCheckbox id={r.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.nombre}</span>
                        {esNuevo(r.creado_en, desde) && <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-medium uppercase tracking-wide text-white">Nuevo</span>}
                      </div>
                      <div className="truncate text-xs text-ink-2">
                        {lista === "descartado" ? r.motivo_descarte : [str(f.lugar) || r.ciudad, r.estado_mx].filter(Boolean).join(" · ") || "Sin ubicación"}
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-ink-2" aria-label="Canales">
                      {r.correo && <span title={`Correo: ${r.correo}`}><MailIcon /></span>}
                      {r.whatsapp && <span title={`WhatsApp: ${r.whatsapp}`}><WhatsAppIcon /></span>}
                      {r.instagram && <span title={`Instagram: ${r.instagram}`}><InstagramIcon /></span>}
                    </span>
                    <Badge tone={est.tone}>{est.label}</Badge>
                  </summary>
                  <div className="space-y-4 bg-[#fcfbf8] px-5 pb-5 pt-1 text-sm">
                    {(() => {
                      const campos = FIELDS.filter(([k], i, xs) => str(f[k]) && xs.findIndex(([, l]) => l === xs[i][1]) === i);
                      const principales = campos.filter(([k]) => ["vimos", "tipo", "siguiente", "evento_actual"].includes(k)).slice(0, 3);
                      const resto = campos.filter((c) => !principales.includes(c) && !["vende", "cobra"].includes(c[0]));
                      return (
                        <>
                          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_1fr]">
                            {r.correo && (
                              <>
                                <dt className="text-ink-2">Correo</dt>
                                <dd className="font-mono text-xs">{r.correo}</dd>
                              </>
                            )}
                            {(principales.length ? principales : campos.slice(0, 2)).map(([k, label]) => (
                              <div key={k} className="contents">
                                <dt className="text-ink-2">{label}</dt>
                                <dd><Assumable text={str(f[k])} /></dd>
                              </div>
                            ))}
                            {dolor && (
                              <>
                                <dt className="text-ink-2">Cómo cobra hoy</dt>
                                <dd>{dolor}{cifra ? <span className="text-ink-2"> · gancho: unos {mxn(cifra)}</span> : null}</dd>
                              </>
                            )}
                          </dl>
                          <details className="group/mas">
                            <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">Ver más: datos, puntaje y evidencia</summary>
                            <div className="mt-3 space-y-4">
                              {resto.length > 0 && (
                                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_1fr]">
                                  {resto.map(([k, label]) => (
                                    <div key={k} className="contents">
                                      <dt className="text-ink-2">{label}</dt>
                                      <dd><Assumable text={str(f[k])} /></dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                              {(tagMap.get(r.id) ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(tagMap.get(r.id) ?? []).map((t) => <TagChip key={t.id} nombre={t.nombre} color={t.color} />)}
                                </div>
                              )}
                              {scoreLines(r.score_detalle_json).length > 0 && (
                                <div>
                                  <p className="mb-1 text-ink-2">Puntaje: {r.score}</p>
                                  <ul className="flex flex-wrap gap-1.5">
                                    {scoreLines(r.score_detalle_json).map((x) => (
                                      <li key={x.clave}><Badge tone={x.peso < 0 ? "bad" : "neutral"}>{x.peso > 0 ? "+" : ""}{x.peso} {x.descripcion}</Badge></li>
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
                            </div>
                          </details>
                        </>
                      );
                    })()}
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
