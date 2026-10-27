import { NextResponse } from "next/server";
import { deviceId } from "@/server/device";
import { clearReplays, listEvents } from "@/server/replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Available replay events (real past fires) with their timeline labels. */
export async function GET() {
  return NextResponse.json(await listEvents());
}

/** Clear this device's replay alerts. */
export async function DELETE(req: Request) {
  const device = deviceId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  return NextResponse.json({ removed: await clearReplays(device) });
}
