"use client";

import { importProjectMd } from "@/app/actions";
import { FormMessage, StatefulForm } from "@/components/client";

export function ImportProjectForm({ primary }: { primary?: boolean }) {
  return (
    <StatefulForm action={importProjectMd} className="flex flex-wrap items-center gap-3">
      {(state, pending) => (
        <>
          <input name="archivo" type="file" accept=".md,text/markdown,text/plain" className="text-sm file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm" required />
          <button className={primary ? "btn btn-primary" : "btn"} disabled={pending}>{pending ? "Importando…" : "Importar proyecto"}</button>
          <a href="/api/plantilla-proyecto" className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">Descargar plantilla .md</a>
          <div className="w-full"><FormMessage state={state} /></div>
        </>
      )}
    </StatefulForm>
  );
}
