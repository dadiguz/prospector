import { Suspense } from "react";
import { io } from "next/cache";
import { readProfile, readSettings } from "@/lib/profile";
import { getSecret, mask } from "@/lib/secrets";
import { dataDir } from "@/lib/paths";
import { all } from "@/lib/db";
import { PageTitle, Section, Badge, Fold } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { ApiKeyForm, SettingsForm, GmailClientForm } from "./forms";
import { gmailStatus } from "@/lib/gmail/oauth";
import { ActionButton } from "@/components/client";
import { disconnectGmail } from "@/app/actions";

async function AjustesContent({ searchParams }: PageProps<"/ajustes">) {
  const sp = await searchParams;
  await io();
  const gmail = await gmailStatus();
  const gmailMsg = typeof sp.gmail === "string" ? sp.gmail : null;
  const profile = readProfile();
  const settings = readSettings();
  const key = await getSecret("anthropic_api_key");
  const uso = all<{ modelo: string; llamadas: number; costo: number }>(
    "SELECT modelo, COUNT(*) llamadas, SUM(costo_usd) costo FROM usage_log WHERE fecha >= date('now','-30 day') GROUP BY modelo ORDER BY costo DESC",
  );

  return (
    <div className="max-w-2xl">
      <PageTitle>Ajustes</PageTitle>

      <Section title="Perfil">
        <ProfileForm profile={profile} />
      </Section>

      <Section title="API key de Claude" aside={key ? <Badge tone="ok">Conectada</Badge> : <Badge>Sin conectar</Badge>}>
        {key && <p className="mb-3 font-mono text-sm text-ink-2">{mask(key)}</p>}
        <ApiKeyForm hasKey={Boolean(key)} />
      </Section>

      <Section
        title="Gmail"
        aside={gmail.conectado ? <Badge tone="ok">Conectado</Badge> : gmail.configurado ? <Badge tone="warn">Falta conectar</Badge> : <Badge>Sin conectar</Badge>}
      >
        {gmailMsg && <p className={`mb-3 text-sm ${/^Conectado/.test(gmailMsg) ? "text-ok" : "text-bad"}`}>{gmailMsg}</p>}
        {gmail.conectado ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Envía como <span className="font-mono">{gmail.email}</span>, con tu firma de Gmail. Permisos: leer hilos, crear borradores, enviar y etiquetar; no borra.
            </p>
            <ActionButton action={disconnectGmail} className="btn btn-quiet" confirm="¿Desconectar Gmail y revocar el acceso de Prospector en Google?">
              Desconectar
            </ActionButton>
          </div>
        ) : (
          <>
            {gmail.configurado && (
              <p className="mb-4 text-sm">
                Credenciales guardadas.{" "}
                <a href="/api/gmail/connect" className="btn ml-2">Conectar con Google</a>
              </p>
            )}
            <Fold title={gmail.configurado ? "Cambiar credenciales del cliente OAuth" : "Configurar (una sola vez, unos 10 minutos)"} open={!gmail.configurado}>
              <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                No necesitas tarjeta. Si Google te ofrece “Prueba gratuita” o “Activar facturación”, ciérralo: entra con tu cuenta de trabajo usando estos enlaces.
              </p>
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                {[
                  ["https://console.cloud.google.com/projectcreate", "Crea un proyecto", "por ejemplo “Prospector”, dentro de la organización de tu empresa."],
                  ["https://console.cloud.google.com/apis/library/gmail.googleapis.com", "Habilita la Gmail API", "revisa que arriba esté seleccionado tu proyecto."],
                  ["https://console.cloud.google.com/auth/overview", "Configura la pantalla de consentimiento", "pon un nombre y tu correo; en público elige Interno."],
                  ["https://console.cloud.google.com/auth/clients", "Crea un cliente OAuth", "tipo de aplicación “App de escritorio”. Copia el Client ID y el Client secret."],
                ].map(([href, label, rest]) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-4">{label}</a>: {rest}
                  </li>
                ))}
                <li>Pégalos aquí, guarda y pulsa “Conectar con Google”.</li>
              </ol>
              <GmailClientForm />
            </Fold>
          </>
        )}
      </Section>

      <Section title="Presupuesto y envío">
        <SettingsForm settings={settings} />
      </Section>

      <Fold title="Consumo de los últimos 30 días">
        {uso.length === 0 ? (
          <p className="text-sm text-ink-2">Sin consumo registrado.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {uso.map((u) => (
                <tr key={u.modelo} className="border-b border-line">
                  <td className="py-2">{u.modelo}</td>
                  <td className="py-2 text-ink-2">{u.llamadas} llamadas</td>
                  <td className="py-2 text-right">US${u.costo.toFixed(2)} (estimado)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Fold>
      <Fold title="Dónde están mis datos">
        <p className="text-sm text-ink-2">
          Base de datos y perfil en <code className="font-mono text-xs">{dataDir()}</code>. Respalda esa carpeta; no la subas a ningún repositorio.
        </p>
      </Fold>
    </div>
  );
}

export default function Ajustes(props: PageProps<"/ajustes">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <AjustesContent {...props} />
    </Suspense>
  );
}
