/**
 * Links satellite heat to the official named fire it most likely belongs to, so a detection can say
 * "likely part of the Quilpituk Creek wildfire". A match is by distance only (agencies publish one point per fire,
 * not live outlines), so the wording always says "likely".
 */
import { distanceKm, type LatLon } from "./geo";
import type { FireStatus } from "./observations";

export interface NamedFireRef {
  id: string;
  name: string;
  status: FireStatus;
  agency: string;
  at: LatLon;
  areaHa?: number;
}

/** How far heat can be from a fire's point and still count: twice the fire's equivalent radius plus 1.5 km, 3–25 km. */
export function matchRadiusKm(areaHa?: number): number {
  const radius = areaHa && areaHa > 0 ? Math.sqrt(areaHa / 100 / Math.PI) : 0;
  return Math.min(25, Math.max(3, radius * 2 + 1.5));
}

export function matchHeatToFire(p: LatLon, fires: NamedFireRef[]): (NamedFireRef & { km: number }) | undefined {
  let best: (NamedFireRef & { km: number }) | undefined;
  for (const f of fires) {
    const km = distanceKm(p, f.at);
    if (km <= matchRadiusKm(f.areaHa) && (!best || km < best.km)) best = { ...f, km };
  }
  return best;
}
