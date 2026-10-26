import { NextResponse } from "next/server";
import { isValidLatLon, RegionCodeSchema } from "@sylvia/core";
import { nurseriesNear } from "@/server/maps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?lat=&lon=&region=: garden centres near a point. The location is not stored. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const at = { lat: Number(q.get("lat")), lon: Number(q.get("lon")) };
  const region = RegionCodeSchema.safeParse(q.get("region"));
  if (!isValidLatLon(at) || !region.success) return NextResponse.json({ error: "Send lat, lon and region." }, { status: 400 });
  try {
    return NextResponse.json(await nurseriesNear(at, region.data));
  } catch (e) {
    console.error("Nursery search failed", e);
    return NextResponse.json({ error: "I couldn't search for garden centres right now." }, { status: 502 });
  }
}
