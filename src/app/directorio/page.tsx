import { Suspense } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
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
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <PageTitle>Directorio</PageTitle>
        <Link href="/directorio/cargar" className="btn mt-3"><Upload size={15} /> Cargar correos</Link>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </>
  );
}
