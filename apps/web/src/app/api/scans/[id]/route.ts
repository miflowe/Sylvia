import { NextResponse } from "next/server";
import { container } from "@/server/cosmos";
import { deviceId } from "@/server/device";
import { deletePhoto } from "@/server/storage";

export const runtime = "nodejs";

/** Delete one of the device's saved scans and its photo. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = deviceId(req);
  const { id } = await params;
  if (!device || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await container("scans").item(id, device).delete();
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await deletePhoto(device, id);
  return new NextResponse(null, { status: 204 });
}
