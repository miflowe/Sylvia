import "server-only";
import { CosmosClient, type Container } from "@azure/cosmos";
import { binomialKey, type RegionVerdict, type Species } from "@sylvia/core";
import { env } from "./env";

let client: CosmosClient | undefined;
function container(name: string): Container {
  client ??= new CosmosClient({ endpoint: env("COSMOS_ENDPOINT"), key: env("COSMOS_KEY") });
  return client.database("sylvia").container(name);
}

// Curated data changes only on import, so cache it in memory for a few minutes per region.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; verdicts: RegionVerdict[]; species: Map<string, Species> }>();

export async function regionData(regionCode: string) {
  const hit = cache.get(regionCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const { resources: verdicts } = await container("regionVerdicts")
    .items.query<RegionVerdict>({ query: "SELECT * FROM c WHERE c.regionCode = @r", parameters: [{ name: "@r", value: regionCode }] }, { partitionKey: regionCode })
    .fetchAll();
  const ids = [...new Set(verdicts.flatMap((v) => [v.speciesId, ...v.swaps.map((s) => s.speciesId)]))];
  const { resources: species } = ids.length
    ? await container("species")
        .items.query<Species>({ query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)", parameters: [{ name: "@ids", value: ids }] })
        .fetchAll()
    : { resources: [] as Species[] };
  const entry = { at: Date.now(), verdicts, species: new Map(species.map((s) => [s.id, s])) };
  cache.set(regionCode, entry);
  return entry;
}

/** The curated verdict for an identified species, matched on genus + species. */
export function findVerdict(data: Awaited<ReturnType<typeof regionData>>, scientificName: string) {
  const key = binomialKey(scientificName);
  const matches = data.verdicts.filter((v) => {
    const s = data.species.get(v.speciesId);
    return s && binomialKey(s.scientificName) === key;
  });
  return matches[0];
}
