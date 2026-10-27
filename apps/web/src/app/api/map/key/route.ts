import { NextResponse } from "next/server";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Azure Maps key for the browser map. The Maps account only accepts browser requests from Sylvia's own web
 * address (CORS rule in infra/resources.bicep), and the subscription has a budget alert.
 */
export async function GET() {
  return NextResponse.json({ key: env("AZURE_MAPS_KEY") }, { headers: { "cache-control": "private, max-age=3600" } });
}
