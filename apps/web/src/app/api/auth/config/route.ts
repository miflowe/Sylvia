import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Public sign-in settings for the browser (none are secrets). `enabled: false` hides sign-in. */
export function GET() {
  const cfg = authConfig();
  return NextResponse.json(cfg ? { enabled: true, ...cfg } : { enabled: false });
}
