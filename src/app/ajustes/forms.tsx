"use client";

import { removeApiKey, saveApiKey, saveSettings, saveGmailClient } from "@/app/actions";
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="topeDiario">Tope de correos por día</label>
              <input id="topeDiario" name="topeDiario" type="number" min={1} max={200} className="input" defaultValue={settings.topeDiario} />
            </div>
            <div>
              <label className="label" htmlFor="presupuestoBusquedaUsd">Presupuesto por búsqueda (US$)</label>
              <input id="presupuestoBusquedaUsd" name="presupuestoBusquedaUsd" type="number" step="0.5" min={0.5} max={100} className="input" defaultValue={settings.presupuestoBusquedaUsd} />
            </div>
            <div>
              <label className="label" htmlFor="busquedasWebPorCandidato">Búsquedas web por candidato</label>
              <input id="busquedasWebPorCandidato" name="busquedasWebPorCandidato" type="number" min={1} max={10} className="input" defaultValue={settings.busquedasWebPorCandidato} />
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="modoEconomico" defaultChecked={settings.modoEconomico} className="mt-1 accent-[var(--accent)]" />
            <span>
              Modo económico
              <span className="block text-xs text-ink-2">Baja un nivel de modelo en cada tarea y hace menos búsquedas por candidato. Las fichas salen menos completas.</span>
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
