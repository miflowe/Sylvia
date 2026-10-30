// Parsers for the public feeds. Pure functions: raw response in, Observations out.
import { agreedCf1, cellIdFor, epaCorrectPm25, SOURCES, type FireStatus, type Observation } from "@sylvia/core";

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

/**
 * PurpleAir /v1/sensors response with fields sensor_index, pm2.5_cf_1_a, pm2.5_cf_1_b, humidity, latitude, longitude,
 * last_seen. Values are US EPA corrected; sensors whose two channels disagree, or with no humidity, are dropped.
 */
export function parsePurpleAir(body: { fields?: string[]; data?: (number | null)[][] }): Observation[] {
  const f = body.fields ?? [];
  const i = (name: string) => f.indexOf(name);
  return (body.data ?? [])
    .map((row) => {
      const cf1 = agreedCf1(row[i("pm2.5_cf_1_a")], row[i("pm2.5_cf_1_b")]);
      const rh = row[i("humidity")];
      return {
        id: row[i("sensor_index")],
        pm: cf1 !== undefined && typeof rh === "number" && cf1 < 1000 ? epaCorrectPm25(cf1, rh) : null,
        lat: row[i("latitude")],
        lon: row[i("longitude")],
        seen: row[i("last_seen")],
      };
    })
    .filter((r): r is { id: number; pm: number; lat: number; lon: number; seen: number } =>
      [r.id, r.pm, r.lat, r.lon, r.seen].every((v) => typeof v === "number"),
    )
    .map((r) => ({
      id: `purpleair:${r.id}`,
      cellId: cellIdFor({ lat: r.lat, lon: r.lon }),
      kind: "pm25" as const,
      source: SOURCES.purpleair,
      location: point(r.lon, r.lat),
      observedAt: new Date(r.seen * 1000).toISOString(),
      value: round(r.pm, 1),
      props: { corrected: "US EPA" },
      ttl: 2 * HOUR,
    }));
}

type PointFeature<P> = { geometry: { type: string; coordinates: number[] } | null; properties: P };

const BC_STATUS: Record<string, FireStatus> = { "Out of Control": "Out of control", "Being Held": "Being held", "Under Control": "Under control" };

/** BC Wildfire Service "Fire Locations - Current" (GeoJSON). Fires that are out are skipped. */
export function parseBcFires(fc: {
  features?: PointFeature<{ FIRE_NUMBER?: string; INCIDENT_NAME?: string; GEOGRAPHIC_DESCRIPTION?: string; FIRE_STATUS?: string; CURRENT_SIZE?: number; FIRE_URL?: string; FIRE_OF_NOTE_IND?: string; IGNITION_DATE?: number }>[];
}): Observation[] {
  const out: Observation[] = [];
  for (const { geometry, properties: p } of fc.features ?? []) {
    const status = p.FIRE_STATUS && BC_STATUS[p.FIRE_STATUS];
    if (!status || geometry?.type !== "Point" || !p.FIRE_NUMBER) continue;
    const [lon, lat] = geometry.coordinates as [number, number];
    // BC names larger fires ("Quilpituk Creek"); others are known by number and place.
    const name = p.INCIDENT_NAME && p.INCIDENT_NAME !== p.FIRE_NUMBER ? `${p.INCIDENT_NAME} wildfire` : `${p.GEOGRAPHIC_DESCRIPTION ?? "Wildfire"} (${p.FIRE_NUMBER})`;
    out.push({
      id: `bcws:${p.FIRE_NUMBER}`,
      cellId: cellIdFor({ lat, lon }),
      kind: "named-fire",
      source: SOURCES.bcws,
      location: point(lon, lat),
      observedAt: new Date().toISOString(),
      value: typeof p.CURRENT_SIZE === "number" ? round(p.CURRENT_SIZE, 1) : undefined,
      label: name,
      props: {
        fireNumber: p.FIRE_NUMBER,
        status,
        agency: "BC Wildfire Service",
        url: p.FIRE_URL ?? SOURCES.bcws.url,
        ofNote: p.FIRE_OF_NOTE_IND === "Y",
        started: p.IGNITION_DATE ? new Date(p.IGNITION_DATE).toISOString() : "",
      },
      ttl: 3 * HOUR,
    });
  }
  return out;
}

// Ontario stage-of-control codes. EX (extinguished) and anything unknown are skipped.
const ON_STATUS: Record<string, FireStatus> = { OC: "Out of control", NUC: "Out of control", BH: "Being held", BHG: "Being held", UC: "Under control", UCO: "Under control", BM: "Being monitored", OBS: "Being monitored" };
// Ontario names fires by district and number, e.g. RED_FIRE_012 is "Red Lake 12".
const ON_DISTRICTS: Record<string, string> = {
  AFA: "Atikokan", CHA: "Chapleau", COC: "Cochrane", DRY: "Dryden", FOR: "Fort Frances", HRN: "Hearst", KEN: "Kenora", KLK: "Kirkland Lake",
  NIP: "Nipigon", NOR: "North Bay", PAR: "Parry Sound", PEM: "Pembroke", RED: "Red Lake", SAU: "Sault Ste. Marie", SLK: "Sioux Lookout",
  SUD: "Sudbury", THU: "Thunder Bay", TIM: "Timmins", WAW: "Wawa",
};

/** Ontario MNR "Ontario Fires" layer (GeoJSON). */
export function parseOntarioFires(fc: {
  features?: PointFeature<{ FIELD_AGENCY_FIRE_ID?: string; FIELD_STAGE_OF_CONTROL_STATUS?: string; FIELD_FIRE_SIZE?: number; FIELD_STATUS_DATE?: number }>[];
}): Observation[] {
  const out: Observation[] = [];
  for (const { geometry, properties: p } of fc.features ?? []) {
    const status = ON_STATUS[(p.FIELD_STAGE_OF_CONTROL_STATUS ?? "").trim()];
    if (!status || geometry?.type !== "Point" || !p.FIELD_AGENCY_FIRE_ID) continue;
    const [lon, lat] = geometry.coordinates as [number, number];
    const m = p.FIELD_AGENCY_FIRE_ID.match(/^([A-Z]{3})_FIRE_0*(\d+)$/);
    const name = m ? `${ON_DISTRICTS[m[1]!] ?? m[1]} ${m[2]}` : p.FIELD_AGENCY_FIRE_ID;
    out.push({
      id: `onfire:${p.FIELD_AGENCY_FIRE_ID}`,
      cellId: cellIdFor({ lat, lon }),
      kind: "named-fire",
      source: SOURCES.ontarioFires,
      location: point(lon, lat),
      observedAt: p.FIELD_STATUS_DATE ? new Date(p.FIELD_STATUS_DATE).toISOString() : new Date().toISOString(),
      value: typeof p.FIELD_FIRE_SIZE === "number" && p.FIELD_FIRE_SIZE >= 0 ? round(p.FIELD_FIRE_SIZE, 1) : undefined,
      label: name,
      props: { fireNumber: p.FIELD_AGENCY_FIRE_ID, status, agency: "Ontario Ministry of Natural Resources", url: SOURCES.ontarioFires.url, ofNote: false, started: "" },
      ttl: 3 * HOUR,
    });
  }
  return out;
}
