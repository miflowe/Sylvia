import "server-only";
import { binomialKey, type Nursery, type RegionVerdict, type Species } from "@sylvia/core";
import { container } from "./cosmos";

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

const nurseryCache = new Map<string, { at: number; nurseries: Nursery[] }>();

/** Grow Me Instead / FireSmart-recognized nurseries for a region (curated sheet). */
export async function curatedNurseries(regionCode: string): Promise<Nursery[]> {
  const hit = nurseryCache.get(regionCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.nurseries;
  const { resources } = await container("nurseriesCurated")
    .items.query<Nursery>({ query: "SELECT * FROM c WHERE c.regionCode = @r", parameters: [{ name: "@r", value: regionCode }] }, { partitionKey: regionCode })
    .fetchAll();
  nurseryCache.set(regionCode, { at: Date.now(), nurseries: resources });
  return resources;
}
