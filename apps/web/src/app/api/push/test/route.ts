import { NextResponse } from "next/server";
import { container } from "@/server/cosmos";
import { deviceId } from "@/server/device";
import { pushToDevice, type StoredSubscription } from "@/server/push";

export const runtime = "nodejs";

/** Sends a test notification to this device so people can check alerts reach them. */
export async function POST(req: Request) {
  const device = deviceId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  const { resource } = await container("pushSubscriptions").item(device, device).read<{ subscription: StoredSubscription }>();
  if (!resource) return NextResponse.json({ error: "Turn on alerts first." }, { status: 404 });
  const result = await pushToDevice(resource.subscription, {
    level: 0,
    title: "Alerts are on",
    body: "This is a test. Sylvia will notify you about fire activity, smoke and official evacuation orders near your home.",
    key: "test",
    sources: [{ name: "Sylvia", observedAt: new Date().toISOString() }],
  });
  return NextResponse.json({ result }, { status: result === "sent" ? 200 : 502 });
}
