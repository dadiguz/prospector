"use client";

import { removeApiKey, saveApiKey, saveSettings, saveGmailClient } from "@/app/actions";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info } from "@/components/info";
import { toast } from "@/components/toaster";
import { ActionButton, FormMessage, StatefulForm } from "@/components/client";
import type { Settings } from "@/lib/profile";

export function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  return (
    <div className="space-y-3">
      <StatefulForm action={saveApiKey} className="flex flex-wrap items-start gap-2">
        {(state, pending) => (
          <>
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              className="input min-w-0 flex-1 font-mono"
              placeholder={hasKey ? "Pega una llave nueva para reemplazarla" : "sk-ant-…"}
            />
            <button className="btn btn-primary" disabled={pending}>{pending ? "Probando…" : hasKey ? "Reemplazar" : "Conectar"}</button>
            <div className="w-full"><FormMessage state={state} /></div>
          </>
        )}
      </StatefulForm>
      {hasKey && (
        <ActionButton action={removeApiKey} className="btn btn-quiet" confirm="¿Borrar la API key de este equipo?">
          Borrar llave
        </ActionButton>
      )}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <StatefulForm action={saveSettings} className="space-y-4">
      {(state, pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="presupuestoBusquedaUsd">Presupuesto por búsqueda (US$)</label>
              <input id="presupuestoBusquedaUsd" name="presupuestoBusquedaUsd" type="number" step="0.5" min={0.5} max={100} className="input" defaultValue={settings.presupuestoBusquedaUsd} />
            </div>
            <div>
              <label className="label" htmlFor="busquedasWebPorCandidato">Búsquedas web por candidato</label>
              <input id="busquedasWebPorCandidato" name="busquedasWebPorCandidato" type="number" min={1} max={10} className="input" defaultValue={settings.busquedasWebPorCandidato} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5" htmlFor="busquedasSimultaneas">Búsquedas a la vez <Info>Las demás esperan en cola.</Info></label>
              <input id="busquedasSimultaneas" name="busquedasSimultaneas" type="number" min={1} max={5} className="input" defaultValue={settings.busquedasSimultaneas} />
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="modoEconomico" defaultChecked={settings.modoEconomico} className="mt-1 accent-[var(--accent)]" />
            <span>
              Modo económico <Info>Modelos más baratos y menos búsquedas; las fichas salen menos completas.</Info>
            </span>
          </label>
          <p className="text-xs text-ink-3">
            Modelos: alto {settings.modelos.alto} · medio {settings.modelos.medio} · bajo {settings.modelos.bajo}
          </p>
          <div className="flex items-center gap-4">
            <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
            <FormMessage state={state} />
          </div>
        </>
      )}
    </StatefulForm>
  );
}

export function GmailClientForm() {
  return (
    <StatefulForm action={saveGmailClient} className="space-y-3">
      {(state, pending) => (
        <>
          <input name="clientId" className="input font-mono" placeholder="Client ID (….apps.googleusercontent.com)" autoComplete="off" />
          <input name="clientSecret" type="password" className="input font-mono" placeholder="Client secret" autoComplete="off" />
          <div className="flex items-center gap-3">
            <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar credenciales"}</button>
            <FormMessage state={state} />
          </div>
        </>
      )}
    </StatefulForm>
  );
}

export function DatosButtons() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-2">
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!window.confirm(`¿Reemplazar todos tus datos con “${f.name}”? Lo actual se guarda antes en respaldos.`)) return;
          start(async () => {
            const fd = new FormData();
            fd.append("archivo", f);
            const r = await fetch("/api/importar", { method: "POST", body: fd })
              .then((x) => x.json())
              .catch(() => ({ error: "No se pudo subir el archivo." }));
            if (r.error) toast(r.error, "error");
            else {
              toast(`Importado: ${r.prospectos} prospectos`);
              router.refresh();
            }
          });
        }}
      />
      <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? "Importando…" : "Importar"}
      </button>
      <a href="/api/exportar" download className="btn">Exportar todo</a>
    </span>
  );
}
