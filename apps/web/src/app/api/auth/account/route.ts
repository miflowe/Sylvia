import { NextResponse } from "next/server";
import { verifiedAccount } from "@/server/auth";
import { deleteAccountData } from "@/server/accounts";

export const runtime = "nodejs";

/** Delete all of the signed-in account's data from Sylvia. The Entra account itself is removed separately. */
export async function DELETE(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const account = token ? await verifiedAccount(token) : undefined;
  if (!account) return NextResponse.json({ error: "Sign in again, then retry." }, { status: 401 });
  await deleteAccountData(account.id);
  return new NextResponse(null, { status: 204 });
}
