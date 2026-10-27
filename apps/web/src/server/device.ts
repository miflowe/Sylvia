import "server-only";
import { verifiedAccount } from "./auth";

/**
 * Anonymous-first: each install gets a random device id (UUID v4) kept in the browser and sent as
 * `x-sylvia-device`. If the person signs in, their account id (`u-<oid>`) owns the data instead.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deviceId(req: Request): string | undefined {
  const id = req.headers.get("x-sylvia-device")?.trim();
  return id && UUID.test(id) ? id.toLowerCase() : undefined;
}

/** Whose data this request reads and writes: the signed-in account, otherwise the device. */
export async function ownerId(req: Request): Promise<string | undefined> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const account = await verifiedAccount(auth.slice(7));
    if (account) return account.id;
  }
  return deviceId(req);
}
