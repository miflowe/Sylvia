// Fills apps/web/.env.local with the Azure endpoints and keys the app needs locally, read from your signed-in
// Azure CLI. Keeps any lines already there (like PLANTNET_API_KEY). Never prints a key.
// Usage: node scripts/dev-env.mjs
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const env = Object.fromEntries(
  sh("azd env get-values")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const host = (url) => new URL(url).hostname.split(".")[0];
const rg = env.AZURE_RESOURCE_GROUP;

const values = {
  AZURE_AI_ENDPOINT: env.AZURE_AI_ENDPOINT,
  AZURE_AI_KEY: sh(`az cognitiveservices account keys list -g ${rg} -n ${host(env.AZURE_AI_ENDPOINT)} --query key1 -o tsv`),
  COSMOS_ENDPOINT: env.COSMOS_ENDPOINT,
  COSMOS_KEY: sh(`az cosmosdb keys list -g ${rg} -n ${host(env.COSMOS_ENDPOINT)} --query primaryMasterKey -o tsv`),
  SEARCH_ENDPOINT: env.SEARCH_ENDPOINT,
  SEARCH_KEY: sh(`az search query-key list -g ${rg} --service-name ${host(env.SEARCH_ENDPOINT)} --query [0].key -o tsv`),
};

const file = "apps/web/.env.local";
const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim()) : [];
const kept = lines.filter((l) => !(l.split("=")[0] in values));
writeFileSync(file, [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n");
console.log(`Updated ${file}: ${Object.keys(values).join(", ")} (kept ${kept.length} existing line(s))`);
