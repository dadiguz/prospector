import type { ReactNode } from "react";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-4xl leading-tight tracking-tight">{children}</h1>
      {sub && <p className="mt-2 max-w-2xl text-ink-2">{sub}</p>}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-2">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Fold({ title, children, open }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="group border-t border-line py-3" open={open}>
      <summary className="flex items-center justify-between text-sm text-ink-2 hover:text-ink">
        <span>{title}</span>
        <span className="text-ink-3 transition group-open:rotate-90">›</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

const TONES = {
  neutral: "bg-[#f1efe8] text-ink-2",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div>
      <div className={`font-serif text-3xl ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      <div className="text-xs text-ink-2">{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-2">{children}</p>;
}

/** Resalta "SUPOSICIÓN" para que no se lea como hecho (sección 4.2). */
export function Assumable({ text }: { text: string }) {
  const parts = text.split(/(SUPOSICI[ÓO]N:?[^.;|]*)/g);
  return (
    <>
      {parts.map((p, i) => (/^SUPOSICI/.test(p) ? <mark key={i} className="suposicion">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export const ESTADO_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  investigado: { label: "Por revisar", tone: "neutral" },
  borrador: { label: "Borrador", tone: "accent" },
  en_espera: { label: "Más tarde", tone: "warn" },
  enviado: { label: "Enviado", tone: "neutral" },
  interesado: { label: "Interesado", tone: "ok" },
  retomar: { label: "Retomar", tone: "warn" },
  cerrado: { label: "Cerrado", tone: "neutral" },
  rebote: { label: "Rebotó", tone: "bad" },
  descartado: { label: "Descartado", tone: "neutral" },
};

export const CLASIF_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  interesado: { label: "Interesado", tone: "ok" },
  acuse: { label: "Lo pasaron a quien decide", tone: "ok" },
  no_ahora: { label: "No ahora", tone: "warn" },
  no: { label: "No", tone: "neutral" },
  rebote: { label: "Rebote", tone: "bad" },
  auto_respuesta: { label: "Auto-respuesta", tone: "neutral" },
  vacia: { label: "Respuesta vacía", tone: "neutral" },
  baja: { label: "Pidió baja", tone: "bad" },
  otro: { label: "Revisar", tone: "warn" },
};

/* Etiquetas de color (búsquedas, tandas y etiquetas propias). */
const TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  terracota: { bg: "#F6E4DB", fg: "#A34E2F" },
  salvia: { bg: "#E3EEE4", fg: "#3F6B4B" },
  azul: { bg: "#E1EAF5", fg: "#33568A" },
  ocre: { bg: "#F5ECD3", fg: "#85631D" },
  ciruela: { bg: "#EEE2EE", fg: "#6E3D6E" },
  petroleo: { bg: "#DDEDEC", fg: "#2C6662" },
  rosa: { bg: "#F7E1E6", fg: "#9A3D55" },
  oliva: { bg: "#ECEEDC", fg: "#5C6224" },
  pizarra: { bg: "#E7E8EB", fg: "#4B5160" },
  arena: { bg: "#F1EBE2", fg: "#6D5A44" },
};

export function TagChip({ nombre, color, active, count }: { nombre: string; color: string; active?: boolean; count?: number }) {
  const s = TAG_STYLE[color] ?? TAG_STYLE.pizarra;
  return (
    <span
      className="inline-flex max-w-[18rem] items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg, boxShadow: active ? `inset 0 0 0 1.5px ${s.fg}` : undefined }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.fg }} aria-hidden="true" />
      <span className="truncate">{nombre}</span>
      {count != null && <span className="opacity-60">{count}</span>}
    </span>
  );
}

/** Barra de filtro por etiqueta: enlaces que conservan los demás parámetros. */
export function TagFilter({ tags, active, hrefFor }: { tags: { id: number; nombre: string; color: string; total?: number }[]; active: number | null; hrefFor: (id: number | null) => string }) {
  if (!tags.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-ink-3">Etiquetas</span>
      {tags.map((t) => (
        <a key={t.id} href={hrefFor(active === t.id ? null : t.id)} className={active && active !== t.id ? "opacity-50 hover:opacity-100" : ""}>
          <TagChip nombre={t.nombre} color={t.color} active={active === t.id} count={t.total} />
        </a>
      ))}
      {active && (
        <a href={hrefFor(null)} className="ml-1 text-xs text-ink-2 underline underline-offset-4">Quitar filtro</a>
      )}
    </div>
  );
}
