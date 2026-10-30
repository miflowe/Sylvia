import { NextResponse } from "next/server";
import { z } from "zod";
import { answerProblem, ASK_FALLBACK, ASK_MAX_CHARS, conditionsFacts, guardQuestion, isValidLatLon, officialInfo, RegionCodeSchema } from "@sylvia/core";
import { getConditions } from "@/server/conditions";
import { ownerId } from "@/server/device";
import { answerQuestion, isPromptAttack, isSafeText } from "@/server/foundry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().max(ASK_MAX_CHARS + 20),
  lat: z.number(),
  lon: z.number(),
  name: z.string().max(80),
  region: z.string().optional(),
  sensitive: z.boolean(),
});

// 8 questions per 10 minutes per device: enough to explore, not enough to run up the AI bill.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;
const recent = new Map<string, number[]>();
function allowed(who: string): boolean {
  const now = Date.now();
  const times = (recent.get(who) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return false;
  recent.set(who, [...times, now]);
  return true;
}

type Used = { name: string; url: string; observedAt?: string };

/**
 * POST { question, lat, lon, name, region, sensitive }: Sylvia answers from the live readings at that place.
 * Question: rule check, then Content Safety (harm + Prompt Shields). Answer: rule check, then Content Safety. Nothing is stored.
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => undefined));
  const at = body.success ? { lat: body.data.lat, lon: body.data.lon } : undefined;
  if (!body.success || !at || !isValidLatLon(at)) return NextResponse.json({ error: "Set your home first, then ask again." }, { status: 400 });
  const who = (await ownerId(req)) ?? req.headers.get("x-forwarded-for") ?? "anon";
  if (!allowed(who)) return NextResponse.json({ error: "That's a lot of questions. Please try again in a few minutes." }, { status: 429 });

  const { question, name, sensitive } = body.data;
  const region = RegionCodeSchema.safeParse(body.data.region);
  const regionCode = region.success ? region.data : undefined;
  const guard = guardQuestion(question, regionCode);
  if (!guard.ok) return NextResponse.json({ answer: guard.reply, used: [], ruled: true });

  try {
    const [safe, attack] = await Promise.all([isSafeText(question), isPromptAttack(question)]);
    if (!safe || attack) return NextResponse.json({ answer: "I can only help with questions about fire, smoke and air quality at your home.", used: [], ruled: true });

    const c = await getConditions(at, name, regionCode, sensitive, false);
    const answer = await answerQuestion(question, conditionsFacts(c, name, sensitive), officialInfo(regionCode));
    const problem = answerProblem(answer);
    if (problem || !(await isSafeText(answer))) {
      if (problem) console.warn("Ask answer replaced:", problem);
      return NextResponse.json({ answer: ASK_FALLBACK, used: [], ruled: true });
    }

    const used: Used[] = [c.fireDanger.source];
    if (c.aqhi) used.push({ ...c.aqhi.source, observedAt: c.aqhi.observedAt });
    if (c.pm25) used.push({ ...c.pm25.source, observedAt: c.pm25.observedAt });
    if (c.smoke) used.push({ ...c.smoke.source, observedAt: c.smoke.issuedAt });
    used.push({ ...c.hotspots.source, observedAt: c.hotspots.latestAt });
    if (c.weather) used.push({ ...c.weather.source, observedAt: c.weather.observedAt });
    return NextResponse.json({ answer, used, ruled: false });
  } catch (e) {
    console.error("Ask failed", e);
    return NextResponse.json({ error: "I couldn't answer just now. Please try again in a minute." }, { status: 502 });
  }
}
