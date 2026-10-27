import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Microsoft Entra External ID (optional sign-in). Off until AUTH_TENANT_SUBDOMAIN, AUTH_TENANT_ID and
// AUTH_CLIENT_ID are set; the app then stays anonymous-only. None of these are secrets.
export function authConfig() {
  const subdomain = process.env.AUTH_TENANT_SUBDOMAIN;
  const tenantId = process.env.AUTH_TENANT_ID;
  const clientId = process.env.AUTH_CLIENT_ID;
  return subdomain && tenantId && clientId ? { subdomain, tenantId, clientId } : undefined;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Verifies an Entra External ID ID token and returns the stable account id, or undefined. */
export async function verifiedAccount(token: string): Promise<{ id: string; name?: string } | undefined> {
  const cfg = authConfig();
  if (!cfg) return undefined;
  jwks ??= createRemoteJWKSet(new URL(`https://${cfg.subdomain}.ciamlogin.com/${cfg.tenantId}/discovery/v2.0/keys`));
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${cfg.tenantId}.ciamlogin.com/${cfg.tenantId}/v2.0`,
      audience: cfg.clientId,
    });
    const oid = (payload.oid as string | undefined) ?? payload.sub;
    return oid ? { id: `u-${oid}`, name: payload.name as string | undefined } : undefined;
  } catch {
    return undefined;
  }
}
