import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { Cargar } from "../cargar";
import { proyectosOpcion } from "../proyectos";

async function Contenido() {
  await connection();
  return <Cargar proyectos={proyectosOpcion()} />;
}

export default function NuevaCarga() {
  return (
    <>
      <Link href="/directorio/cargar" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ChevronLeft size={15} /> Cargas</Link>
      <PageTitle>Nueva carga</PageTitle>
      <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </>
  );
}
