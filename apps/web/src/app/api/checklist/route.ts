import { NextResponse } from "next/server";
import { z } from "zod";
import { CHECKLIST, checklistProgress, communityFor } from "@sylvia/core";
import { container } from "@/server/cosmos";
import { deviceId } from "@/server/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ids = new Set(CHECKLIST.map((i) => i.id));
const Body = z.object({
  done: z.record(z.string(), z.boolean()),
  home: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
});

export async function GET(req: Request) {
  const device = deviceId(req);
  if (!device) return NextResponse.json({ error: "Missing device id." }, { status: 400 });
  const { resource } = await container("checklists").item(device, device).read<{ done: Record<string, boolean>; updatedAt: string }>();
  return NextResponse.json({ done: resource?.done ?? {}, updatedAt: resource?.updatedAt ?? null });
}

/**
 * Save the checklist. The home location is used only to tag which community page the progress counts toward
 * (e.g. Central Okanagan); the coordinates themselves are not stored.
 */
export async function PUT(req: Request) {
  const device = deviceId(req);
  const body = Body.safeParse(await req.json().catch(() => undefined));
  if (!device || !body.success) return NextResponse.json({ error: "Couldn't save your checklist." }, { status: 400 });
  const done = Object.fromEntries(Object.entries(body.data.done).filter(([k, v]) => ids.has(k) && v));
  const community = body.data.home ? communityFor(body.data.home) : undefined;
  await container("checklists").items.upsert({
    id: device,
    deviceOrUserId: device,
    done,
    percent: checklistProgress(done).percent,
    communityId: community?.id ?? null,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, community: community?.name ?? null });
}
