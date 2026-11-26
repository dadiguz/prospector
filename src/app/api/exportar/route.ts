import { connection } from "next/server";
import { exportarTodo } from "@/lib/exportar";

/** Descarga todos los datos: CSV por tabla, copia de la base y archivos. Sin secretos. */
export async function GET() {
  await connection();
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(exportarTodo()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="prosp-${fecha}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
