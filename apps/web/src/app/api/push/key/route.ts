import { NextResponse } from "next/server";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** The public VAPID key the browser needs to subscribe to push notifications. */
export function GET() {
  return NextResponse.json({ publicKey: env("VAPID_PUBLIC_KEY") });
}
