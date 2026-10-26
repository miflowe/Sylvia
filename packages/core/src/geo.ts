/** Location helpers. Sylvia stores as little location precision as each feature needs. */

export interface LatLon {
  lat: number;
  lon: number;
}

/** Sightings keep ~1 km precision (2 decimal places), never the exact spot someone stood. */
export function roundForSighting({ lat, lon }: LatLon): LatLon {
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

/** Partition cell of ~11 km (1 decimal place), so map queries for an area hit few partitions. */
export function cellIdFor({ lat, lon }: LatLon): string {
  return `${(Math.floor(lat * 10) / 10).toFixed(1)}:${(Math.floor(lon * 10) / 10).toFixed(1)}`;
}

export function isValidLatLon(p: Partial<LatLon>): p is LatLon {
  return (
    typeof p.lat === "number" && typeof p.lon === "number" && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
  );
}

export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|inc|ltd|limited|garden|gardens|centre|center|nursery|nurseries)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * A search result counts as a curated (Grow Me Instead / FireSmart) nursery when it is within 300 m of one, or
 * within 2 km with the same distinctive name.
 */
export function matchCurated<T extends { name: string; location: LatLon }>(
  place: { name: string; location: LatLon },
  curated: T[],
): T | undefined {
  const name = normalizeName(place.name);
  return curated.find((c) => {
    const d = distanceKm(place.location, c.location);
    return d <= 0.3 || (d <= 2 && name.length >= 3 && name === normalizeName(c.name));
  });
}
