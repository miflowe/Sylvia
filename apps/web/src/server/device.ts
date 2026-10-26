import "server-only";

/**
 * Anonymous-first: each install gets a random device id (UUID v4) kept in the browser and sent as
 * `x-sylvia-device`. It partitions the person's own data (saved scans, checklist, alerts). Optional sign-in will
 * later link it to an account.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deviceId(req: Request): string | undefined {
  const id = req.headers.get("x-sylvia-device")?.trim();
  return id && UUID.test(id) ? id.toLowerCase() : undefined;
}
