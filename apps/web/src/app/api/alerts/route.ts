import { NextResponse } from "next/server";
import { container } from "@/server/cosmos";
import { ownerId } from "@/server/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This device's alert history, newest first, plus whether alerts are on. */
export async function GET(req: Request) {
  const device = await ownerId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  const [{ resources: alerts }, { resource: sub }] = await Promise.all([
    container("alerts")
      .items.query(
        {
          query: "SELECT c.id, c.level, c.title, c.body, c.sources, c.official, c.issuingAgency, c.url, c.replay, c.createdAt FROM c WHERE c.deviceOrUserId = @d ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50",
          parameters: [{ name: "@d", value: device }],
        },
        { partitionKey: device },
      )
      .fetchAll(),
    container("pushSubscriptions").item(device, device).read<{ home: { name: string } }>(),
  ]);
  return NextResponse.json({ alerts, subscribed: !!sub, homeName: sub?.home.name });
}
