import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, listDrafts } from "@/lib/queries";
import { readProfile, readSettings } from "@/lib/profile";
import { json } from "@/lib/db";
import { PageTitle, Empty, TagFilter } from "@/components/ui";
import { projectTags, tagsByProspect } from "@/lib/tags";
import { lastSeen, esNuevo } from "@/lib/vistas";
import { SeenTracker } from "@/components/seen-tracker";
import { DraftsBoard } from "./board";
import { gmailStatus } from "@/lib/gmail/oauth";

async function BorradoresContent({ params, searchParams }: PageProps<"/proyectos/[slug]/borradores">) {
  const { slug } = await params;
  const sp = await searchParams;
  const project = await getProject(slug);
  if (!project) notFound();
  const tags = projectTags(project.id);
  const tagId = tags.some((t) => String(t.id) === sp.tag) ? Number(sp.tag) : null;
  const { drafts, enviadosHoy } = await listDrafts(project.id, tagId);
  const tagMap = tagsByProspect(drafts.map((d) => d.prospect_id));
  const desde = lastSeen(project.id, "borradores");
  const profile = readProfile();
  const settings = readSettings();
  const gmail = await gmailStatus();
  const cfg = json<{ gmail?: { etiqueta?: string } }>(project.config_json, {});

  return (
    <>
      <SeenTracker projectId={project.id} seccion="borradores" />
      <PageTitle sub="Revisa, edita y manda. Nada sale sin que tú lo decidas.">Borradores</PageTitle>
      <TagFilter tags={tags} active={tagId} hrefFor={(id) => (id ? `?tag=${id}` : "?")} />
      {drafts.length === 0 ? (
        <Empty>{tagId ? "No hay borradores con esta etiqueta." : "No hay borradores. Créalos desde Prospectos: selecciona y pulsa “Crear borradores”."}</Empty>
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
              tags: tagMap.get(d.prospect_id) ?? [],
              nuevo: esNuevo(d.creado_en, desde),
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
