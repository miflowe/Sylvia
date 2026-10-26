import "server-only";
import { distanceKm, matchCurated, type LatLon, type NearbyNursery } from "@sylvia/core";
import { env } from "./env";
import { curatedNurseries } from "./plants";

// Azure Maps POI category for "house garden: garden centers services".
const GARDEN_CENTRES = "9361032";
const RADIUS_M = 30000;

interface PoiResult {
  poi: { name: string; url?: string };
  address?: { freeformAddress?: string };
  position: { lat: number; lon: number };
}

/**
 * Garden centres near a point: curated Grow Me Instead / FireSmart nurseries first (with badges), then Azure Maps
 * results. The location is used for this search only and never stored.
 */
export async function nurseriesNear(at: LatLon, regionCode: string): Promise<NearbyNursery[]> {
  const params = new URLSearchParams({
    "api-version": "1.0",
    query: "garden centre",
    categorySet: GARDEN_CENTRES,
    lat: String(at.lat),
    lon: String(at.lon),
    radius: String(RADIUS_M),
    limit: "15",
    countrySet: "CA",
    language: "en-CA",
    "subscription-key": env("AZURE_MAPS_KEY"),
  });
  const [res, curated] = await Promise.all([
    fetch(`https://atlas.microsoft.com/search/poi/category/json?${params}`, { signal: AbortSignal.timeout(10000) }),
    curatedNurseries(regionCode),
  ]);
  const pois = res.ok ? (((await res.json()) as { results?: PoiResult[] }).results ?? []) : [];
  if (!res.ok) console.warn(`Azure Maps ${res.status}`);

  const curatedPlaces = curated.map((c) => ({
    ...c,
    location: { lat: c.location.coordinates[1], lon: c.location.coordinates[0] },
  }));
  const out: NearbyNursery[] = [];
  const usedCurated = new Set<string>();

  for (const p of pois) {
    const match = matchCurated({ name: p.poi.name, location: p.position }, curatedPlaces);
    if (match) usedCurated.add(match.id);
    out.push({
      name: match?.name ?? p.poi.name,
      address: p.address?.freeformAddress,
      distanceKm: round1(distanceKm(at, p.position)),
      location: p.position,
      programs: match?.programs ?? [],
      website: match?.website ?? p.poi.url,
      source: match ? "curated" : "azure-maps",
    });
  }
  // Curated nurseries within range that the map search missed.
  for (const c of curatedPlaces) {
    const d = distanceKm(at, c.location);
    if (usedCurated.has(c.id) || d > RADIUS_M / 1000) continue;
    out.push({ name: c.name, address: c.city, distanceKm: round1(d), location: c.location, programs: c.programs, website: c.website, source: "curated" });
  }
  return out
    .sort((a, b) => Number(b.programs.length > 0) - Number(a.programs.length > 0) || a.distanceKm - b.distanceKm)
    .slice(0, 6);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
