import { NextResponse } from "next/server";
import { ownerId } from "@/server/device";
import { getPhoto } from "@/server/storage";

export const runtime = "nodejs";

/** A saved scan's photo, only for its owner (fetched with headers, shown as a blob URL). Photos are deleted after 30 days. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerId(req);
  const { id } = await params;
  if (!owner || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const photo = await getPhoto(owner, id);
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
}
