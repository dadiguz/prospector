import { Suspense } from "react";
import { directorio } from "@/lib/queries";
import { PageTitle } from "@/components/ui";
import { DirectoryTable } from "./table";

async function Contenido() {
  const filas = await directorio();
  return <DirectoryTable filas={filas} />;
}

export default function Directorio() {
  return (
    <>
      <PageTitle>Directorio</PageTitle>
      <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </>
  );
}
