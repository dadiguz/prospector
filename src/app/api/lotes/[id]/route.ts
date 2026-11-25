import { connection } from "next/server";
import { agregarImagen } from "@/lib/lotes";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

/** Sube una imagen a la tanda (se ajusta a 1200 px y se guarda como JPG). */
export async function POST(req: Request, ctx: RouteContext<"/api/lotes/[id]">) {
  await connection();
  const id = Number((await ctx.params).id);
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("imagen");
  if (!Number.isInteger(id) || !(f instanceof File)) return Response.json({ error: "Falta la imagen." }, { status: 400 });
  if (!TIPOS.includes(f.type)) return Response.json({ error: "Usa una imagen JPG, PNG, WebP o GIF." }, { status: 400 });
  if (f.size > 15_000_000) return Response.json({ error: "La imagen pesa más de 15 MB." }, { status: 400 });
  try {
    const img = await agregarImagen(id, Buffer.from(await f.arrayBuffer()), f.name);
    return Response.json({ ok: true, img });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
