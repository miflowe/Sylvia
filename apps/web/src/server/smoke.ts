import "server-only";
import { smokeOutlook, type LatLon, type SmokeForecast, type SmokePoint } from "@sylvia/core";

/** ECCC GeoMet layer: surface PM2.5 from wildfire smoke (FireWork, part of the RAQDPS model). Values are kg/m³. */
export const SMOKE_LAYER = "RAQDPS.Sfc_PM2.5-WildfireSmokePlume";
const GEOMET = "https://geo.weather.gc.ca/geomet";
const HOURS_AHEAD = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];

interface FeatureInfo {
  features?: { properties: { value: number; time: string; dim_reference_time: string } }[];
}

async function valueAt(at: LatLon, time: string): Promise<{ point: SmokePoint; issuedAt: string } | undefined> {
  const d = 0.05;
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetFeatureInfo",
    layers: SMOKE_LAYER,
    query_layers: SMOKE_LAYER,
    crs: "EPSG:4326",
    bbox: `${at.lat - d},${at.lon - d},${at.lat + d},${at.lon + d}`,
    width: "3",
    height: "3",
    i: "1",
    j: "1",
    info_format: "application/json",
    time,
  });
  const res = await fetch(`${GEOMET}?${q}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return undefined;
  const f = ((await res.json()) as FeatureInfo).features?.[0]?.properties;
  if (!f || typeof f.value !== "number") return undefined;
  return { point: { at: f.time, ugm3: Math.max(0, f.value * 1e9) }, issuedAt: f.dim_reference_time };
}

/** The next 48 hours of wildfire smoke at one place, every 3 hours. Undefined if GeoMet is unreachable. */
export async function smokeForecast(at: LatLon): Promise<SmokeForecast | undefined> {
  const base = Math.ceil(Date.now() / 3600000) * 3600000;
  const results = await Promise.all(
    HOURS_AHEAD.map((h) => valueAt(at, new Date(base + h * 3600000).toISOString().replace(".000", "")).catch(() => undefined)),
  );
  const ok = results.filter((r) => r !== undefined);
  // A forecast with big gaps could miss the smoke; better to show nothing than a wrong "no smoke".
  if (ok.length < HOURS_AHEAD.length * 0.75) return undefined;
  return smokeOutlook(ok.map((r) => r.point), ok[0]!.issuedAt);
}
