import { NextResponse } from "next/server";
import { isValidLatLon } from "@sylvia/core";
import { ownerId } from "@/server/device";
import { createReport } from "@/server/reports";

export const runtime = "nodejs";

const MAX_PHOTO = 4 * 1024 * 1024;

/**
 * POST multipart: kind (smoke | flames | ash | glow), lat, lon, optional note (≤140 characters) and photo (JPEG, made
 * by the app, EXIF removed). The location is rounded to about 1 km before it's stored. Reports vanish after 6 hours.
 */
export async function POST(req: Request) {
  const device = await ownerId(req);
  const form = await req.formData().catch(() => undefined);
  if (!device || !form) return NextResponse.json({ error: "Couldn't send that report." }, { status: 400 });
  const at = { lat: Number(form.get("lat")), lon: Number(form.get("lon")) };
  if (!isValidLatLon(at)) return NextResponse.json({ error: "Choose where you saw it." }, { status: 400 });
  const photo = form.get("photo");
  let jpeg: Buffer | undefined;
  if (photo instanceof Blob && photo.size > 0) {
    if (photo.type !== "image/jpeg" || photo.size > MAX_PHOTO) return NextResponse.json({ error: "That photo couldn't be used." }, { status: 400 });
    jpeg = Buffer.from(await photo.arrayBuffer());
  }
  try {
    const r = await createReport({ device, kind: String(form.get("kind") ?? ""), lat: at.lat, lon: at.lon, note: form.get("note")?.toString(), photo: jpeg });
    return r.ok ? NextResponse.json({ id: r.id }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) {
    console.error("Report failed", e);
    return NextResponse.json({ error: "Couldn't send that report. Please try again. If you see flames, call 911." }, { status: 502 });
  }
}
