import { connection } from "next/server";
import { importarTodo } from "@/lib/importar";

/** Recibe un .zip de "Exportar todo" y reemplaza los datos (guarda antes una copia de lo actual). */
export async function POST(req: Request) {
  await connection();
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("archivo");
  if (!(f instanceof File) || f.size === 0) return Response.json({ error: "Elige el .zip del respaldo." }, { status: 400 });
  try {
    const r = importarTodo(Buffer.from(await f.arrayBuffer()));
    return Response.json({ ok: true, prospectos: r.prospectos });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
