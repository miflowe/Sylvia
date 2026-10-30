import { reportPhoto } from "@/server/reports";

export const runtime = "nodejs";

/** A resident report's photo, while the report is still on the map. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await reportPhoto((await params).id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600" } });
}
