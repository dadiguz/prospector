import { Suspense } from "react";
import { io } from "next/cache";
import { emptyDoc } from "@/lib/project-md";
import { readProfile } from "@/lib/profile";
import { ProjectEditor } from "../editor";

async function NuevoContent() {
  await io();
  return (
    <>
      <ProjectEditor title="Nuevo proyecto" initial={{ ...emptyDoc(), empresa: readProfile()?.empresa ?? "" }} existingSlug={null} />
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
