import { NextResponse } from "next/server";
import { ownerId } from "@/server/device";
import { clearReplays, getEvent, listEvents } from "@/server/replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Available replay events (real past fires) with their timeline labels; ?id= returns one event's full archive for the map. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json(await listEvents());
  const event = id.length <= 80 ? await getEvent(id) : undefined;
  if (!event) return NextResponse.json({ error: "Replay not found." }, { status: 404 });
  return NextResponse.json(event);
}

/** Clear this device's replay alerts. */
export async function DELETE(req: Request) {
  const device = await ownerId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  return NextResponse.json({ removed: await clearReplays(device) });
}
