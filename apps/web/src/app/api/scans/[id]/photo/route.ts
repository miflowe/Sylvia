import { NextResponse } from "next/server";
import { deviceId } from "@/server/device";
import { getPhoto } from "@/server/storage";

export const runtime = "nodejs";

/** A saved scan's photo, only for the device that saved it. Photos are deleted after 30 days. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  // <img> can't send headers, so the device id may also come as ?d=.
  const device = deviceId(req) ?? deviceId(new Request(req.url, { headers: { "x-sylvia-device": url.searchParams.get("d") ?? "" } }));
  const { id } = await params;
  if (!device || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const photo = await getPhoto(device, id);
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
}
