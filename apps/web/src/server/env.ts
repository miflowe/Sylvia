import "server-only";

type Key =
  | "AZURE_AI_ENDPOINT"
  | "AZURE_AI_KEY"
  | "COSMOS_ENDPOINT"
  | "COSMOS_KEY"
  | "SEARCH_ENDPOINT"
  | "SEARCH_KEY"
  | "PLANTNET_API_KEY"
  | "STORAGE_CONNECTION"
  | "AZURE_MAPS_KEY"
  | "VAPID_PUBLIC_KEY"
  | "VAPID_PRIVATE_KEY";

/** Reads a required setting; fails loudly so a missing key is obvious in logs, not a silent bad answer. */
export function env(key: Key): string {
  const v = process.env[key];
  if (!v || v === "not-set") throw new Error(`Missing ${key}. Locally, run: node scripts/dev-env.mjs`);
  return v.replace(/\/$/, "");
}

export function hasEnv(key: Key): boolean {
  const v = process.env[key];
  return !!v && v !== "not-set";
}
