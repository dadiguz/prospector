"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveProject } from "@/app/actions";
import { Field, FieldLoader } from "@/components/wand-field";
import { PARTES, type Parte } from "@/lib/project-gen-partes";
import { Info } from "@/components/info";
import type { ProjectDoc, Fact } from "@/lib/project-md";
import type { Campo } from "@/lib/wand";
import { hookFigure, mxn } from "@/lib/hook-formula";
import { Plus, X } from "lucide-react";

function Card({ n, title, hint, children, loading }: { n: number; title: string; hint?: string; children: ReactNode; loading?: boolean }) {
  return (
    <section className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1efe8] text-xs font-medium text-ink-2">{n}</span>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">{title}{hint && <Info label={`Sobre ${title}`}>{hint}</Info>}</h2>
      </div>
      {loading ? (
        <div className="space-y-3" aria-label="Generando">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-9"><FieldLoader /></div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">{children}</div>
      )}
    </section>
  );
}

function RowShell({ children, onRemove, bare }: { children: ReactNode; onRemove: () => void; bare?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onRemove} className={`btn btn-quiet btn-icon text-ink-3 ${bare ? "" : "mt-[1.6rem]"}`} aria-label="Quitar"><X size={15} strokeWidth={1.8} /></button>
    </div>
  );
}
const AddButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="btn btn-quiet btn-sm -ml-2" style={{ color: "var(--accent)" }}><Plus size={14} strokeWidth={2} aria-hidden />{children}</button>
);

const csv = (xs: string[]) => xs.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim());
const keyOf = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").split("_").slice(0, 5).join("_");

/* ---------- Editor ---------- */

const FACT_GROUPS: { tipo: Fact["tipo"]; title: string; hint: string; campo: Campo; terminos: boolean }[] = [
  { tipo: "si_afirmar", title: "Se puede afirmar", hint: "Funciones reales del producto. Solo esto aparece en correos y respuestas.", campo: "fact_si", terminos: false },
  { tipo: "no_afirmar", title: "No afirmar", hint: "Lo que no existe. Las palabras que pongas bloquean el envío si aparecen en un correo.", campo: "fact_no", terminos: true },
  { tipo: "no_mencionar", title: "No mencionar", hint: "Cosas que existen pero no se deben nombrar en correos nuevos.", campo: "fact_no", terminos: true },
  { tipo: "pendiente", title: "Pendiente de confirmar", hint: "No se promete hasta confirmarlo.", campo: "fact_pendiente", terminos: false },
];

export function ProjectEditor({ initial, existingSlug, title }: { initial: ProjectDoc; existingSlug: string | null; title: string }) {
  const [d, setD] = useState<ProjectDoc>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string } | null>(null);
  const router = useRouter();
  // Partes que se están generando desde la idea (solo en un proyecto nuevo).
  const [cargando, setCargando] = useState<Parte[]>([]);
  const gen = (p: Parte) => cargando.includes(p);
  useEffect(() => {
    if (existingSlug) return;
    const onGenerar = async (e: Event) => {
      const idea = (e as CustomEvent<string>).detail;
      setMsg(null);
      setCargando(PARTES);
      setD((x) => ({ ...x, idea }));
      window.dispatchEvent(new CustomEvent("proyecto:estado", { detail: true }));
      try {
        const res = await fetch("/api/proyecto-idea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo generar.");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const linea = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!linea.trim()) continue;
            const ev = JSON.parse(linea) as { tipo: string; parte?: Parte; data?: Partial<ProjectDoc>; error?: string };
            if (ev.tipo === "parte" && ev.parte) {
              setD((x) => ({ ...x, ...ev.data }));
              setCargando((c) => c.filter((p) => p !== ev.parte));
            } else if (ev.tipo === "error") {
              setMsg({ error: ev.error });
              if (ev.parte) setCargando((c) => c.filter((p) => p !== ev.parte));
            }
          }
        }
      } catch (err) {
        setMsg({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        setCargando([]);
        window.dispatchEvent(new CustomEvent("proyecto:estado", { detail: false }));
      }
    };
    window.addEventListener("proyecto:generar", onGenerar);
    return () => window.removeEventListener("proyecto:generar", onGenerar);
  }, [existingSlug]);
  const set = <K extends keyof ProjectDoc>(k: K, v: ProjectDoc[K]) => setD((x) => ({ ...x, [k]: v }));

  const base = `Proyecto: ${d.nombre || "(sin nombre)"}\nEmpresa: ${d.empresa}\nIdea: ${d.idea}\nPropuesta de valor: ${d.propuesta_valor}`;
  const ficha = `\nSe puede afirmar: ${d.facts.filter((f) => f.tipo === "si_afirmar").map((f) => f.afirmacion).join("; ")}\nNo afirmar: ${d.facts.filter((f) => f.tipo !== "si_afirmar").map((f) => f.afirmacion).join("; ")}`;
  const perfil = `\nPerfil del cliente ideal: ${d.pesos.map((p) => `${p.descripcion} (${p.peso})`).join("; ")}`;

  const updFact = (i: number, patch: Partial<Fact>) => set("facts", d.facts.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const hook = d.hook;

  const save = () =>
    start(async () => {
      const r = await saveProject(d, existingSlug);
      setMsg(r);
      if (r?.ok && r.slug) router.push(`/proyectos/${r.slug}`);
    });

  return (
    <div className="space-y-8 pb-16">
      <div className="sticky top-0 z-20 -mx-4 -mt-2 flex flex-wrap items-center justify-between gap-3 bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <h1 className="font-serif text-4xl leading-tight tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {msg?.error && <span className="text-sm text-bad">{msg.error}</span>}
          <button type="button" className="btn btn-quiet" onClick={() => router.back()}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={pending || cargando.length > 0} onClick={save}>{pending ? "Guardando…" : existingSlug ? "Guardar cambios" : "Crear proyecto"}</button>
        </div>
      </div>
      <Card n={1} title="Lo básico">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field loading={gen("basico")} label="Nombre del proyecto" value={d.nombre} onChange={(v) => set("nombre", v)} campo="nombre" contexto={base} placeholder="Ej. Sistema de reservas" />
          <Field label="Empresa" value={d.empresa} onChange={(v) => set("empresa", v)} placeholder="Tu empresa y ciudad" />
        </div>
        <Field loading={gen("basico")} label="Idea" rows={2} value={d.idea} onChange={(v) => set("idea", v)} campo="idea" contexto={base} placeholder="Qué quieres lograr con esta prospección" />
        <Field loading={gen("basico")} label="Propuesta de valor" rows={4} value={d.propuesta_valor} onChange={(v) => set("propuesta_valor", v)} campo="propuesta_valor" contexto={base + ficha} hint="Base de todos los correos. Qué es, para quién y qué cambia." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field loading={gen("basico")} label="Métrica principal" value={d.metrica_principal} onChange={(v) => set("metrica_principal", v)} campo="metrica_principal" contexto={base} />
          <Field loading={gen("basico")} label="Conversión" value={d.conversion} onChange={(v) => set("conversion", v)} campo="conversion" contexto={base} hint="Qué cuenta como cliente ganado" />
          <Field loading={gen("basico")} label="Meta actual" value={d.meta_actual} onChange={(v) => set("meta_actual", v)} campo="meta_actual" contexto={base} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field loading={gen("basico")} label="Voz" value={d.voz} onChange={(v) => set("voz", v)} campo="voz" contexto={base} />
          <Field loading={gen("basico")} label="Etiqueta de Gmail" value={d.gmailEtiqueta} onChange={(v) => set("gmailEtiqueta", v)} placeholder={`Prospección/${d.nombre || "Proyecto"}`} />
        </div>
      </Card>

      <Card n={2} loading={gen("ficha")} title="Ficha de verdad" hint="Lo que se puede y no se puede decir. El validador la usa para bloquear promesas falsas.">
        {FACT_GROUPS.map((g) => (
          <div key={g.tipo} className="space-y-3 border-t border-line pt-6 first:border-0 first:pt-0">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">{g.title}<Info label={g.title}>{g.hint}</Info></h3>
            {d.facts.map((f, i) => {
              if (f.tipo !== g.tipo) return null;
              const bare = d.facts.findIndex((x) => x.tipo === g.tipo) !== i;
              return (
                <RowShell key={i} bare={bare} onRemove={() => set("facts", d.facts.filter((_, j) => j !== i))}>
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <Field bare={bare} label="Afirmación" value={f.afirmacion} onChange={(v) => updFact(i, { afirmacion: v })} campo={g.campo} contexto={base + ficha} />
                    {g.terminos ? (
                      <Field bare={bare} label="Palabras que bloquean" value={csv(f.terminos)} onChange={(v) => updFact(i, { terminos: fromCsv(v) })} placeholder="separadas por coma" />
                    ) : (
                      <Field bare={bare} label="Evidencia" value={f.evidencia} onChange={(v) => updFact(i, { evidencia: v })} placeholder="Dónde lo comprobaste" />
                    )}
                  </div>
                </RowShell>
              );
            })}
            <AddButton onClick={() => set("facts", [...d.facts, { afirmacion: "", tipo: g.tipo, evidencia: "", terminos: [] }])}>Agregar</AddButton>
          </div>
        ))}
      </Card>

      <Card n={3} loading={gen("ficha")} title="Gancho" hint="Una cifra que el prospecto entiende al instante. P es el precio de cada prospecto.">
        {!hook ? (
          <AddButton onClick={() => set("hook", { clave: "", nombre: "", formula: "", multiplicador: 100, redondeo: 100, frase: "unos {cifra} por cada 100 ventas", condicion: "", supuestos: [] })}>
            Agregar un gancho
          </AddButton>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={hook.nombre} onChange={(v) => set("hook", { ...hook, nombre: v })} campo="hook_nombre" contexto={base} />
              <Field label="Fórmula" value={hook.formula} onChange={(v) => set("hook", { ...hook, formula: v })} mono placeholder="ahorro = 0.05 * P" hint="Números, P, + − × ÷ y paréntesis" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_3fr]">
              <label className="block"><span className="label">Por cada</span><input type="number" className="input" value={hook.multiplicador} onChange={(e) => set("hook", { ...hook, multiplicador: Number(e.target.value) || 1 })} /></label>
              <label className="block"><span className="label">Redondeo</span><input type="number" className="input" value={hook.redondeo} onChange={(e) => set("hook", { ...hook, redondeo: Number(e.target.value) || 1 })} /></label>
              <Field label="Frase en el correo" value={hook.frase} onChange={(v) => set("hook", { ...hook, frase: v })} campo="hook_frase" contexto={base} />
            </div>
            <HookPreview formula={hook.formula} multiplicador={hook.multiplicador} redondeo={hook.redondeo} />
            <Field label="Cuándo usarlo" value={hook.condicion} onChange={(v) => set("hook", { ...hook, condicion: v })} campo="hook_condicion" contexto={base} />
            <div className="space-y-2">
              <span className="label">Supuestos</span>
              {hook.supuestos.map((s, i) => (
                <RowShell key={i} onRemove={() => set("hook", { ...hook, supuestos: hook.supuestos.filter((_, j) => j !== i) })}>
                  <Field label={`Supuesto ${i + 1}`} value={s} onChange={(v) => set("hook", { ...hook, supuestos: hook.supuestos.map((x, j) => (j === i ? v : x)) })} campo="supuesto" contexto={`${base}\nFórmula: ${hook.formula}`} />
                </RowShell>
              ))}
              <div className="flex gap-2">
                <AddButton onClick={() => set("hook", { ...hook, supuestos: [...hook.supuestos, ""] })}>Agregar supuesto</AddButton>
                <button type="button" className="btn btn-quiet text-sm text-bad" onClick={() => set("hook", null)}>Quitar gancho</button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card n={4} loading={gen("perfil")} title="Perfil del cliente ideal" hint="Atributos observables con su peso. Suman al puntaje de cada prospecto; los negativos restan.">
        {d.pesos.map((p, i) => (
          <RowShell key={i} onRemove={() => set("pesos", d.pesos.filter((_, j) => j !== i))}>
            <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
              <label className="block">
                <span className="label">Peso</span>
                <input type="number" min={-100} max={100} className={`input ${p.peso < 0 ? "text-bad" : ""}`} value={p.peso} onChange={(e) => set("pesos", d.pesos.map((x, j) => (j === i ? { ...x, peso: Number(e.target.value) } : x)))} />
              </label>
              <Field
                label="Atributo"
                value={p.descripcion}
                onChange={(v) => set("pesos", d.pesos.map((x, j) => (j === i ? { ...x, descripcion: v, clave: initial.pesos.some((o) => o.clave === x.clave && x.clave) ? x.clave : keyOf(v) } : x)))}
                campo="peso"
                contexto={base + perfil}
                hint={p.clave ? `clave: ${p.clave}` : undefined}
              />
            </div>
          </RowShell>
        ))}
        <AddButton onClick={() => set("pesos", [...d.pesos, { clave: "", descripcion: "", peso: 10 }])}>Agregar atributo</AddButton>
      </Card>

      <Card n={5} loading={gen("perfil")} title="Descalificadores" hint="Reglas que sacan a un prospecto. Duro: se descarta. Blando: se pospone o baja de prioridad.">
        {d.descalificadores.map((q, i) => (
          <RowShell key={i} onRemove={() => set("descalificadores", d.descalificadores.filter((_, j) => j !== i))}>
            <div className="grid gap-2 sm:grid-cols-[7rem_2fr_1fr]">
              <label className="block">
                <span className="label">Tipo</span>
                <select className="select" value={q.tipo} onChange={(e) => set("descalificadores", d.descalificadores.map((x, j) => (j === i ? { ...x, tipo: e.target.value as "duro" | "blando" } : x)))}>
                  <option value="duro">Duro</option>
                  <option value="blando">Blando</option>
                </select>
              </label>
              <Field label="Regla" value={q.regla} onChange={(v) => set("descalificadores", d.descalificadores.map((x, j) => (j === i ? { ...x, regla: v } : x)))} campo="descalificador" contexto={base + perfil} />
              <Field label="Origen" value={q.origen} onChange={(v) => set("descalificadores", d.descalificadores.map((x, j) => (j === i ? { ...x, origen: v } : x)))} placeholder="Por qué existe" />
            </div>
          </RowShell>
        ))}
        <AddButton onClick={() => set("descalificadores", [...d.descalificadores, { regla: "", tipo: "duro", origen: "" }])}>Agregar regla</AddButton>
      </Card>

      <Card n={6} loading={gen("segmentos")} title="Segmentos">
        {d.segmentos.map((s, i) => {
          const upd = (patch: Partial<typeof s>) => set("segmentos", d.segmentos.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          const ctx = `${base}${perfil}\nSegmento: ${s.nombre}\n${s.definicion}`;
          return (
            <div key={i} className="rounded-xl border border-line p-4">
              <RowShell onRemove={() => set("segmentos", d.segmentos.filter((_, j) => j !== i))}>
                <div className="space-y-3">
                  <Field label="Nombre del segmento" value={s.nombre} onChange={(v) => upd({ nombre: v })} campo="segmento_nombre" contexto={ctx} />
                  <Field label="Definición" rows={2} value={s.definicion} onChange={(v) => upd({ definicion: v })} campo="segmento_definicion" contexto={ctx} />
                  <div className="space-y-2">
                    <span className="label">Frases de búsqueda</span>
                    {s.consultas.map((c, k) => (
                      <RowShell key={k} onRemove={() => upd({ consultas: s.consultas.filter((_, j) => j !== k) })}>
                        <Field label={`Búsqueda ${k + 1}`} value={c} onChange={(v) => upd({ consultas: s.consultas.map((x, j) => (j === k ? v : x)) })} campo="consulta" contexto={`${ctx}\nOtras búsquedas: ${s.consultas.filter((_, j) => j !== k).join(" | ")}`} />
                      </RowShell>
                    ))}
                    <AddButton onClick={() => upd({ consultas: [...s.consultas, ""] })}>Agregar búsqueda</AddButton>
                  </div>
                </div>
              </RowShell>
            </div>
          );
        })}
        <AddButton onClick={() => set("segmentos", [...d.segmentos, { nombre: "", definicion: "", consultas: [""] }])}>Agregar segmento</AddButton>
      </Card>

      <Card n={7} loading={gen("mensajes")} title="Mensajes" hint="Plantillas con variables entre llaves: {saludo}, {observacion}, {cifra}, {evento_siguiente}, {que_venden}, {empresa_corta}.">
        <Field
          label="Asunto del correo"
          value={d.plantillaCorreo?.asunto ?? ""}
          onChange={(v) => set("plantillaCorreo", { asunto: v, cuerpo: d.plantillaCorreo?.cuerpo ?? "" })}
          campo="plantilla_asunto"
          contexto={base}
        />
        <Field
          label="Cuerpo del primer correo"
          rows={12}
          value={d.plantillaCorreo?.cuerpo ?? ""}
          onChange={(v) => set("plantillaCorreo", { asunto: d.plantillaCorreo?.asunto ?? "", cuerpo: v })}
          campo="plantilla_correo"
          contexto={base + ficha + (hook ? `\nGancho: ${hook.frase}` : "")}
          hint="5 a 8 líneas, sin enlaces, un solo gancho. Termina en “Saludos cordiales,”: la firma la pone Gmail."
        />
        <Field
          label="Mensaje de WhatsApp"
          rows={6}
          value={d.plantillaWhatsapp ?? ""}
          onChange={(v) => set("plantillaWhatsapp", v)}
          campo="plantilla_whatsapp"
          contexto={base + ficha}
          hint="Variables: {nombre}, {mi_nombre}, {empresa_corta}, {observacion_corta}"
        />
      </Card>

      <Card n={8} title="Investigación y territorio">
        <Field loading={gen("basico")} label="Instrucciones de investigación" rows={4} value={d.investigacion} onChange={(v) => set("investigacion", v)} campo="investigacion" contexto={base + perfil} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estados excluidos" value={csv(d.territorio.excluidos)} onChange={(v) => set("territorio", { ...d.territorio, excluidos: fromCsv(v) })} placeholder="separados por coma" />
          <Field label="Excepciones" value={d.territorio.excepciones.join("; ")} onChange={(v) => set("territorio", { ...d.territorio, excepciones: v.split(";").map((x) => x.trim()) })} placeholder="separadas por punto y coma" />
        </div>
        <Field loading={gen("perfil")} label="Nota de territorio" value={d.territorio.nota} onChange={(v) => set("territorio", { ...d.territorio, nota: v })} />
        <Field
          label="Sitios en los que no insistir"
          rows={3}
          value={d.noInsistir.join("\n")}
          onChange={(v) => set("noInsistir", v.split("\n").map((x) => x.trim()))}
          placeholder="un dominio por línea"
          hint="Sitios que bloquean o no sirven; la búsqueda los evita."
        />
      </Card>

    </div>
  );
}

function HookPreview({ formula, multiplicador, redondeo }: { formula: string; multiplicador: number; redondeo: number }) {
  let out: ReactNode;
  try {
    out = [200, 500, 1200, 3000].map((p) => {
      const c = formula.trim() ? hookFigure(formula, p, multiplicador, redondeo) : null;
      return (
        <span key={p} className="rounded-md border border-line bg-bg px-2 py-1">
          P = {mxn(p)} → {c ? `unos ${mxn(c)}` : "—"}
        </span>
      );
    });
  } catch (e) {
    out = <span className="text-bad">{(e as Error).message}</span>;
  }
  return <div className="flex flex-wrap gap-2 text-xs text-ink-2">{out}</div>;
}
