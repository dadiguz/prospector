import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { readProject } from "@/lib/project-md";
import { PageTitle } from "@/components/ui";
import { ProjectEditor } from "../../editor";

async function EditarContent({ params }: PageProps<"/proyectos/[slug]/editar">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return (
    <>
      <PageTitle>Editar proyecto</PageTitle>
      <ProjectEditor initial={readProject(project.id)} existingSlug={project.slug} />
    </>
  );
}

export default function Editar(props: PageProps<"/proyectos/[slug]/editar">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <EditarContent {...props} />
    </Suspense>
  );
}
