import { NextResponse } from "next/server";
import { communityStats } from "@/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous community totals for towns and regional districts. Groups smaller than 5 are hidden. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const stats = await communityStats(id);
    return stats ? NextResponse.json(stats, { headers: { "cache-control": "public, max-age=300" } }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (e) {
    console.error("Community stats failed", e);
    return NextResponse.json({ error: "Couldn't load community data right now." }, { status: 502 });
  }
}
