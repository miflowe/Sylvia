import { NextResponse } from "next/server";
import { mapLayers } from "@/server/mapdata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?bbox=w,s,e,n&zoom=z: GeoJSON for each map layer in view. Limited to Canada. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const parts = (q.get("bbox") ?? "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "Send bbox=west,south,east,north." }, { status: 400 });
  }
  const [w, s, e, n] = parts as [number, number, number, number];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const bbox: [number, number, number, number] = [clamp(w, -141.5, -52), clamp(s, 41.5, 70), clamp(e, -141.5, -52), clamp(n, 41.5, 70)];
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return NextResponse.json({ error: "That area is outside Canada." }, { status: 400 });
  try {
    const layers = await mapLayers(bbox, Number(q.get("zoom")) >= 6);
    return NextResponse.json(layers, { headers: { "cache-control": "public, max-age=120" } });
  } catch (e) {
    console.error("Map data failed", e);
    return NextResponse.json({ error: "I couldn't load the map data right now." }, { status: 502 });
  }
}
