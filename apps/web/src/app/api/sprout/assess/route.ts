import { NextResponse } from "next/server";
import { z } from "zod";
import { RegionCodeSchema, type RegionCode } from "@sylvia/core";
import { assess } from "@/server/sprout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ region: RegionCodeSchema, scientificName: z.string().min(3).max(120) });

/** POST JSON { region, scientificName }: the verdict for a species the person picked from the alternatives. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => undefined));
  if (!body.success) return NextResponse.json({ error: "Send a region and a scientific name." }, { status: 400 });
  try {
    return NextResponse.json(await assess(body.data.scientificName, body.data.region as RegionCode));
  } catch (e) {
    console.error("Assess failed", e);
    return NextResponse.json({ error: "I couldn't look that plant up right now. Please try again." }, { status: 502 });
  }
}
