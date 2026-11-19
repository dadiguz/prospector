import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, listDrafts } from "@/lib/queries";
import { readProfile, readSettings } from "@/lib/profile";
import { json } from "@/lib/db";
import { PageTitle, Empty } from "@/components/ui";
import { DraftsBoard } from "./board";
import { gmailStatus } from "@/lib/gmail/oauth";

async function BorradoresContent({ params }: PageProps<"/proyectos/[slug]/borradores">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const { drafts, enviadosHoy } = await listDrafts(project.id);
  const profile = readProfile();
  const settings = readSettings();
  const gmail = await gmailStatus();
  const cfg = json<{ gmail?: { etiqueta?: string } }>(project.config_json, {});

  return (
    <>
      <PageTitle sub="Revisa, edita y manda. Nada sale sin que tú lo decidas.">Borradores</PageTitle>
      {drafts.length === 0 ? (
        <Empty>No hay borradores. Créalos desde Prospectos, en la lista A.</Empty>
      ) : (
        <DraftsBoard
          projectId={project.id}
          drafts={drafts.map((d) => {
            const f = json<Record<string, unknown>>(d.ficha_json, {});
            return {
              id: d.id,
              nombre: d.nombre,
              para: d.para,
              asunto: d.asunto,
              cuerpo: d.cuerpo,
              issues: d.issues,
              score: d.score,
              pegas: typeof f.pegas === "string" ? f.pegas : null,
              cuando: typeof f.cuando_mandar === "string" ? f.cuando_mandar : null,
            };
          })}
          remitente={gmail.conectado ? gmail.email ?? "" : profile?.correo ?? ""}
          gmailConectado={gmail.conectado}
          etiqueta={cfg.gmail?.etiqueta ?? `Prospección/${project.nombre}`}
          tope={settings.topeDiario}
          enviadosHoy={enviadosHoy}
        />
      )}
    </>
  );
}

export default function Borradores(props: PageProps<"/proyectos/[slug]/borradores">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <BorradoresContent {...props} />
    </Suspense>
  );
}
