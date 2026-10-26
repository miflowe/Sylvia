/**
 * Fallback verdicts outside the curated pilots, from VASCAN (Database of Vascular Plants of Canada) on GBIF,
 * which records native / introduced status per province. Invasiveness is never inferred here: an introduced
 * plant comes back as "introduced" with lower confidence.
 */
import type { RegionCode } from "./regions";

export const VASCAN_DATASET = "3f8a1297-3259-4700-91fc-acc4170b27ce";
const API = "https://api.gbif.org/v1";

export interface FallbackVerdict {
  regionCode: RegionCode;
  scientificName: string;
  status: "native" | "introduced" | "unknown";
  confidence: "lower";
  source: { name: string; url: string };
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

interface SearchResponse {
  results?: { key: number; canonicalName?: string }[];
}
interface DistributionResponse {
  results?: { locationId?: string; establishmentMeans?: string }[];
}

export async function vascanVerdict(
  scientificName: string,
  regionCode: RegionCode,
  fetcher: Fetcher = fetch,
): Promise<FallbackVerdict> {
  const base = { regionCode, scientificName, confidence: "lower" as const };
  const search = await fetcher(
    `${API}/species/search?datasetKey=${VASCAN_DATASET}&rank=SPECIES&limit=1&q=${encodeURIComponent(scientificName)}`,
  );
  const hit = search.ok ? ((await search.json()) as SearchResponse).results?.[0] : undefined;
  if (!hit || hit.canonicalName?.toLowerCase() !== scientificName.trim().toLowerCase()) {
    return {
      ...base,
      status: "unknown",
      source: { name: "VASCAN via GBIF (no exact match)", url: `https://www.gbif.org/dataset/${VASCAN_DATASET}` },
    };
  }
  const res = await fetcher(`${API}/species/${hit.key}/distributions?limit=100`);
  const rows = res.ok ? ((await res.json()) as DistributionResponse).results ?? [] : [];
  const means = rows.find((r) => r.locationId === `ISO3166-2:${regionCode}`)?.establishmentMeans?.toUpperCase();
  const status = means === "NATIVE" ? "native" : means === "INTRODUCED" ? "introduced" : "unknown";
  return { ...base, status, source: { name: "VASCAN via GBIF", url: `https://www.gbif.org/species/${hit.key}` } };
}
