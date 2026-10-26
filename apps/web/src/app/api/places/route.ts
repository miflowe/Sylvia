import { NextResponse } from "next/server";
import { isValidLatLon } from "@sylvia/core";
import { reversePlace, searchPlaces } from "@/server/places";

export const runtime = "nodejs";

/** GET ?q=kenora (search) or ?lat=&lon= (name a location). Canada only. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const text = q.get("q")?.trim();
  if (text) return NextResponse.json(text.length >= 2 ? await searchPlaces(text.slice(0, 100)) : []);
  const at = { lat: Number(q.get("lat")), lon: Number(q.get("lon")) };
  if (!isValidLatLon(at)) return NextResponse.json({ error: "Send q, or lat and lon." }, { status: 400 });
  return NextResponse.json(await reversePlace(at.lat, at.lon));
}
