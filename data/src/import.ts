// `pnpm data:import`: validates the curation sheets, upserts them into Cosmos DB and rebuilds the look-alike
// search index. Keys are read from your signed-in Azure CLI at run time and never written to disk.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CosmosClient } from "@azure/cosmos";
import { loadCuration } from "./parse";
import { embed, embeddingText, lookAlikes, putIndex, searchDocFor, uploadDocs } from "./search";

const sh = (cmd: string) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const env = Object.fromEntries(
  sh("azd env get-values")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
) as Record<string, string>;

const need = (k: string) => env[k] || (console.error(`Missing ${k} in the azd environment. Run azd provision first.`), process.exit(1));
const rg = need("AZURE_RESOURCE_GROUP");
const host = (url: string) => new URL(url).hostname.split(".")[0]!;
const cosmosEndpoint = need("COSMOS_ENDPOINT");
const aiEndpoint = need("AZURE_AI_ENDPOINT");
const searchEndpoint = need("SEARCH_ENDPOINT");

const dir = fileURLToPath(new URL("../curation", import.meta.url));
const { species, verdicts, nurseries, errors } = loadCuration(dir);
if (errors.length) {
  console.error(`Fix these before importing:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

console.log("Reading keys from Azure CLI…");
const cosmosKey = sh(`az cosmosdb keys list -g ${rg} -n ${host(cosmosEndpoint)} --query primaryMasterKey -o tsv`);
const aiKey = sh(`az cognitiveservices account keys list -g ${rg} -n ${host(aiEndpoint)} --query key1 -o tsv`);
const searchKey = sh(`az search admin-key show -g ${rg} --service-name ${host(searchEndpoint)} --query primaryKey -o tsv`);

const db = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey }).database("sylvia");
async function upsertAll<T extends { id: string }>(container: string, docs: T[]) {
  const c = db.container(container);
  for (const d of docs) await c.items.upsert(d);
  console.log(`  ${container}: ${docs.length}`);
}
console.log("Cosmos DB:");
await upsertAll("species", species);
await upsertAll("regionVerdicts", verdicts);
await upsertAll("nurseriesCurated", nurseries);

console.log("AI Search:");
const byId = new Map(species.map((s) => [s.id, s]));
const natives = verdicts.filter((v) => v.status === "native");
const docs = natives.map((v) => searchDocFor(v, byId.get(v.speciesId)!));
const vectors = await embed(aiEndpoint, aiKey, natives.map((v) => embeddingText(byId.get(v.speciesId)!)));
docs.forEach((d, i) => (d.embedding = vectors[i]));
await putIndex(searchEndpoint, searchKey);
await uploadDocs(searchEndpoint, searchKey, docs);
console.log(`  native-plants: ${docs.length} documents`);

// Smoke test: the closest Ontario native to Japanese barberry's description.
const barberry = byId.get("berberis-thunbergii");
if (barberry) {
  await new Promise((r) => setTimeout(r, 1500)); // index is near-real-time
  const [v] = await embed(aiEndpoint, aiKey, [embeddingText(barberry)]);
  const hits = await lookAlikes(searchEndpoint, searchKey, v!, "CA-ON");
  console.log("Look-alikes for Japanese barberry in CA-ON:");
  for (const h of hits) console.log(`  ${h.commonName} (${h["@search.score"].toFixed(3)})`);
}
