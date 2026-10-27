"use client";
import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser";

// Optional sign-in with Microsoft Entra External ID (email one-time passcode). Loaded only when it's configured.
type Config = { enabled: false } | { enabled: true; subdomain: string; tenantId: string; clientId: string };
const SCOPES = ["openid", "profile"];

let configPromise: Promise<Config> | undefined;
export function authConfig(): Promise<Config> {
  configPromise ??= fetch("/api/auth/config")
    .then((r) => (r.ok ? (r.json() as Promise<Config>) : { enabled: false as const }))
    .catch(() => ({ enabled: false as const }));
  return configPromise;
}

let msalPromise: Promise<PublicClientApplication | undefined> | undefined;
function msal(): Promise<PublicClientApplication | undefined> {
  msalPromise ??= (async () => {
    const cfg = await authConfig();
    if (!cfg.enabled) return undefined;
    const { PublicClientApplication } = await import("@azure/msal-browser");
    const app = new PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: `https://${cfg.subdomain}.ciamlogin.com/${cfg.tenantId}/`,
        knownAuthorities: [`${cfg.subdomain}.ciamlogin.com`],
        redirectUri: `${location.origin}/auth`,
        postLogoutRedirectUri: `${location.origin}/profile`,
      },
      cache: { cacheLocation: "localStorage" },
    });
    await app.initialize();
    return app;
  })();
  return msalPromise;
}

export async function currentAccount(): Promise<AccountInfo | undefined> {
  const app = await msal();
  return app?.getActiveAccount() ?? app?.getAllAccounts()[0] ?? undefined;
}

/** A fresh ID token for the signed-in account, or undefined when signed out (requests then use the device id). */
export async function idToken(): Promise<string | undefined> {
  const app = await msal();
  const account = await currentAccount();
  if (!app || !account) return undefined;
  try {
    return (await app.acquireTokenSilent({ scopes: SCOPES, account })).idToken;
  } catch {
    return undefined;
  }
}

export async function signIn(): Promise<void> {
  const app = await msal();
  await app?.loginRedirect({ scopes: SCOPES, redirectStartPage: `${location.origin}/profile` });
}

export async function signOut(): Promise<void> {
  const app = await msal();
  const account = await currentAccount();
  await app?.logoutRedirect({ account });
}

/** Runs on /auth after Entra sends the person back. Returns the account if sign-in just completed. */
export async function finishSignIn(): Promise<AccountInfo | undefined> {
  const app = await msal();
  const result = await app?.handleRedirectPromise();
  if (result?.account) app!.setActiveAccount(result.account);
  return result?.account ?? undefined;
}
