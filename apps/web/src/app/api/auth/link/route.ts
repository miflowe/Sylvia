import { NextResponse } from "next/server";
import { verifiedAccount } from "@/server/auth";
import { linkDevice } from "@/server/accounts";
import { deviceId } from "@/server/device";

export const runtime = "nodejs";

/** After sign-in: move this device's data into the account. Needs both the device id and a valid ID token. */
export async function POST(req: Request) {
  const device = deviceId(req);
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const account = token ? await verifiedAccount(token) : undefined;
  if (!device || !account) return NextResponse.json({ error: "Sign in again, then retry." }, { status: 401 });
  return NextResponse.json({ name: account.name ?? null, moved: await linkDevice(device, account.id) });
}
