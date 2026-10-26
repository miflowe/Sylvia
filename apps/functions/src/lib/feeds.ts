// Parsers for the public feeds. Pure functions: raw response in, Observations out.
import { cellIdFor, SOURCES, type Observation } from "@sylvia/core";

const HOUR = 3600;
const point = (lon: number, lat: number) => ({ type: "Point" as const, coordinates: [round(lon, 4), round(lat, 4)] as [number, number] });
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** NASA FIRMS area CSV (VIIRS or MODIS). acq_time is HHMM in UTC. */
export function parseFirmsCsv(csv: string): Observation[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (!header?.startsWith("latitude")) return [];
  const cols = header.split(",");
  const at = (r: string[], name: string) => r[cols.indexOf(name)] ?? "";
  return rows
    .map((line) => line.split(","))
    .filter((r) => r.length === cols.length)
    .map((r) => {
      const lat = Number(at(r, "latitude"));
      const lon = Number(at(r, "longitude"));
      const time = at(r, "acq_time").padStart(4, "0");
      const observedAt = `${at(r, "acq_date")}T${time.slice(0, 2)}:${time.slice(2)}:00Z`;
      const satellite = at(r, "satellite");
      return {
        id: `firms:${round(lat, 4)}_${round(lon, 4)}_${at(r, "acq_date")}${time}_${satellite}`,
        cellId: cellIdFor({ lat, lon }),
        kind: "hotspot" as const,
        source: SOURCES.firms,
        location: point(lon, lat),
        observedAt,
        value: Number(at(r, "frp")) || undefined, // fire radiative power, MW
        props: { satellite, instrument: at(r, "instrument"), confidence: at(r, "confidence"), daynight: at(r, "daynight") },
        ttl: 48 * HOUR,
      };
    })
    .filter((o) => Number.isFinite(o.location.coordinates[0]) && Number.isFinite(o.location.coordinates[1]));
}

interface GeoJsonFeature<P> {
  id?: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: P;
}

/** CWFIS m3_polygons_current (satellite-derived fire perimeters), requested in EPSG:4326. */
export function parseCwfisPerimeters(fc: { features?: GeoJsonFeature<{ firstdate?: string; lastdate?: string; area?: number; hcount?: number }>[] }): Observation[] {
  const out: Observation[] = [];
  for (const f of fc.features ?? []) {
    const ring = outerRing(f.geometry);
    if (!ring || ring.length < 3) continue;
    const [lon, lat] = centroid(ring);
    const simplified = simplify(ring, 400);
    out.push({
      id: `cwfis-m3:${f.id ?? `${round(lat, 3)}_${round(lon, 3)}_${f.properties.firstdate}`}`,
      cellId: cellIdFor({ lat, lon }),
      kind: "fire-perimeter",
      source: SOURCES.cwfis,
      location: point(lon, lat),
      observedAt: f.properties.lastdate ?? new Date().toISOString(),
      value: f.properties.area, // hectares
      props: { firstSeen: f.properties.firstdate ?? "", hotspotCount: f.properties.hcount ?? 0 },
      shape: { type: "Polygon", coordinates: [simplified.map(([x, y]) => [round(x!, 4), round(y!, 4)])] },
      ttl: 6 * HOUR,
    });
  }
  return out;
}

function outerRing(g: GeoJsonFeature<unknown>["geometry"]): number[][] | undefined {
  if (!g) return undefined;
  if (g.type === "Polygon") return (g.coordinates as number[][][])[0];
  if (g.type === "MultiPolygon") {
    // Largest polygon's outer ring.
    const polys = g.coordinates as number[][][][];
    return polys.map((p) => p[0]!).sort((a, b) => b.length - a.length)[0];
  }
  return undefined;
}

function centroid(ring: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon!;
    y += lat!;
  }
  return [x / ring.length, y / ring.length];
}

/** Keeps every nth vertex so a perimeter stays well under Cosmos DB's document size limit. */
function simplify(ring: number[][], maxPoints: number): number[][] {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil(ring.length / maxPoints);
  const kept = ring.filter((_, i) => i % step === 0);
  kept.push(ring[0]!); // close the ring
  return kept;
}

/** MSC GeoMet aqhi-observations-realtime, latest observation per station. */
export function parseAqhi(fc: {
  features?: GeoJsonFeature<{ location_id: string; location_name_en: string; aqhi: number | null; observation_datetime: string; latest?: boolean }>[];
}): Observation[] {
  const byStation = new Map<string, Observation>();
  for (const f of fc.features ?? []) {
    const p = f.properties;
    if (p.aqhi === null || p.aqhi === undefined || f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const o: Observation = {
      id: `aqhi:${p.location_id}`,
      cellId: cellIdFor({ lat, lon }),
      kind: "aqhi",
      source: SOURCES.aqhi,
      location: point(lon, lat),
      observedAt: p.observation_datetime,
      value: round(p.aqhi, 1),
      label: p.location_name_en,
      ttl: 6 * HOUR,
    };
    const prev = byStation.get(p.location_id);
    if (!prev || prev.observedAt < o.observedAt) byStation.set(p.location_id, o);
  }
  return [...byStation.values()];
}

/** PurpleAir /v1/sensors response with fields sensor_index, pm2.5_10minute, latitude, longitude, last_seen. */
export function parsePurpleAir(body: { fields?: string[]; data?: (number | null)[][] }): Observation[] {
  const f = body.fields ?? [];
  const i = (name: string) => f.indexOf(name);
  return (body.data ?? [])
    .map((row) => ({
      id: row[i("sensor_index")],
      pm: row[i("pm2.5_10minute")],
      lat: row[i("latitude")],
      lon: row[i("longitude")],
      seen: row[i("last_seen")],
    }))
    .filter((r): r is { id: number; pm: number; lat: number; lon: number; seen: number } =>
      [r.id, r.pm, r.lat, r.lon, r.seen].every((v) => typeof v === "number"),
    )
    .filter((r) => r.pm >= 0 && r.pm < 1000) // drop obviously broken sensors
    .map((r) => ({
      id: `purpleair:${r.id}`,
      cellId: cellIdFor({ lat: r.lat, lon: r.lon }),
      kind: "pm25" as const,
      source: SOURCES.purpleair,
      location: point(r.lon, r.lat),
      observedAt: new Date(r.seen * 1000).toISOString(),
      value: round(r.pm, 1),
      ttl: 2 * HOUR,
    }));
}
