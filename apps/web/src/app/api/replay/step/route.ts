import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerId } from "@/server/device";
import { getEvent, runFrame } from "@/server/replay";

export const runtime = "nodejs";

const Body = z.object({ eventId: z.string().max(80), frame: z.number().int().min(0).max(50), runId: z.string().uuid(), sensitive: z.boolean() });

/** POST { eventId, frame, runId, sensitive }: run one frame of a replay for this device. */
export async function POST(req: Request) {
  const device = await ownerId(req);
  const body = Body.safeParse(await req.json().catch(() => undefined));
  if (!device || !body.success) return NextResponse.json({ error: "Couldn't run that replay step." }, { status: 400 });
  const event = await getEvent(body.data.eventId);
  if (!event) return NextResponse.json({ error: "Replay not found." }, { status: 404 });
  const result = await runFrame(event, body.data.frame, device, body.data.runId, body.data.sensitive);
  if (!result) return NextResponse.json({ error: "That replay has finished." }, { status: 404 });
  return NextResponse.json(result);
}
