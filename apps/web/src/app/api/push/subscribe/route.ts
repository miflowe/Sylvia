import { NextResponse } from "next/server";
import { z } from "zod";
import { RegionCodeSchema } from "@sylvia/core";
import { container } from "@/server/cosmos";
import { deviceId } from "@/server/device";

export const runtime = "nodejs";

const Body = z.object({
  subscription: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  home: z.object({ name: z.string().max(100), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), regionCode: RegionCodeSchema.optional() }),
  sensitive: z.boolean(),
});

/**
 * Turn alerts on (or update the home area). Stores the push subscription with the home area rounded to ~1 km,
 * which is what's needed to match nearby fire activity and official orders.
 */
export async function POST(req: Request) {
  const device = deviceId(req);
  const body = Body.safeParse(await req.json().catch(() => undefined));
  if (!device || !body.success) return NextResponse.json({ error: "Couldn't turn on alerts." }, { status: 400 });
  const lat = Math.round(body.data.home.lat * 100) / 100;
  const lon = Math.round(body.data.home.lon * 100) / 100;
  await container("pushSubscriptions").items.upsert({
    id: device,
    deviceOrUserId: device,
    subscription: body.data.subscription,
    home: { ...body.data.home, lat, lon },
    location: { type: "Point", coordinates: [lon, lat] },
    sensitive: body.data.sensitive,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

/** Turn alerts off: deletes the subscription and the stored home area. Alert history stays until removed. */
export async function DELETE(req: Request) {
  const device = deviceId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  await container("pushSubscriptions").item(device, device).delete().catch(() => {});
  return new NextResponse(null, { status: 204 });
}
