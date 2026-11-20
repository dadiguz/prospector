import { Suspense } from "react";
import { io } from "next/cache";
import { emptyDoc } from "@/lib/project-md";
import { PageTitle } from "@/components/ui";
import { ProjectEditor } from "../editor";

async function NuevoContent() {
  await io();
  return (
    <>
      <PageTitle sub="Llena lo que sepas; la varita te ayuda a redactar o mejorar cada campo. Puedes volver a editarlo cuando quieras.">Nuevo proyecto</PageTitle>
      <ProjectEditor initial={emptyDoc()} existingSlug={null} />
    </>
  );
}

export default function Nuevo() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <NuevoContent />
    </Suspense>
  );
}
