import { NextResponse } from "next/server";
import { isValidLatLon, RegionCodeSchema } from "@sylvia/core";
import { getConditions } from "@/server/conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?lat=&lon=&name=&region=&sensitive=1: local fire, smoke, air and weather conditions. Nothing is stored. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const at = { lat: Number(q.get("lat")), lon: Number(q.get("lon")) };
  if (!isValidLatLon(at)) return NextResponse.json({ error: "Send lat and lon." }, { status: 400 });
  const region = RegionCodeSchema.safeParse(q.get("region"));
  const name = (q.get("name") ?? "Your home").slice(0, 80);
  try {
    return NextResponse.json(await getConditions(at, name, region.success ? region.data : undefined, q.get("sensitive") === "1"));
  } catch (e) {
    console.error("Conditions failed", e);
    return NextResponse.json({ error: "I couldn't load conditions right now. Please try again in a minute." }, { status: 502 });
  }
}
