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
