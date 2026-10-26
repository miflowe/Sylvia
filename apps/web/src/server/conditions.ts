import "server-only";
import {
  aqhiCategory,
  compass,
  conditionsFacts,
  distanceKm,
  findForbiddenClaims,
  fireDangerFromGridcode,
  pm25Label,
  SOURCES,
  type Conditions,
  type LatLon,
  type Observation,
} from "@sylvia/core";
import { container } from "./cosmos";
import { isSafeText, writeSummary } from "./foundry";

const HOTSPOT_KM = 50;
const FIRE_KM = 100;
const AQHI_KM = 120;
const PM_KM = 10;

// Small in-memory caches keyed by a ~5 km grid cell, so repeat visits don't hit CWFIS or the AI every time.
const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}
const gridKey = (p: LatLon) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

async function near(kind: Observation["kind"], at: LatLon, km: number): Promise<Observation[]> {
  const { resources } = await container("observations")
    .items.query<Observation>({
      query: "SELECT * FROM c WHERE c.kind = @k AND ST_DISTANCE(c.location, @p) <= @m",
      parameters: [
        { name: "@k", value: kind },
        { name: "@p", value: { type: "Point", coordinates: [at.lon, at.lat] } },
        { name: "@m", value: km * 1000 },
      ],
    })
    .fetchAll();
  return resources;
}

const km = (at: LatLon, o: Observation) => distanceKm(at, { lat: o.location.coordinates[1], lon: o.location.coordinates[0] });
const r1 = (n: number) => Math.round(n * 10) / 10;

async function fireDanger(at: LatLon): Promise<Conditions["fireDanger"]> {
  return cached(`fdr:${gridKey(at)}`, 60 * 60 * 1000, async () => {
    const url = new URL("https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows");
    url.search = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "public:fdr_current_shp",
      outputFormat: "application/json",
      propertyName: "GRIDCODE",
      cql_filter: `INTERSECTS(the_geom,SRID=4326;POINT(${at.lon} ${at.lat}))`,
    }).toString();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const body = (await res.json()) as { features?: { properties: { GRIDCODE: number } }[] };
      const level = body.features?.[0] && fireDangerFromGridcode(body.features[0].properties.GRIDCODE);
      return level
        ? { level, source: SOURCES.cwfis }
        : { level: null, reason: "Not rated for this area (cities and some regions aren't on the forest fire-danger map)", source: SOURCES.cwfis };
    } catch {
      return { level: null, reason: "Couldn't reach Natural Resources Canada right now", source: SOURCES.cwfis };
    }
  });
}

async function weather(at: LatLon): Promise<Conditions["weather"]> {
  return cached(`wx:${gridKey(at)}`, 15 * 60 * 1000, async () => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${at.lat}&longitude=${at.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC`,
        { signal: AbortSignal.timeout(8000) },
      );
      const c = ((await res.json()) as { current: { time: string; temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; wind_direction_10m: number } }).current;
      return {
        tempC: Math.round(c.temperature_2m),
        humidity: Math.round(c.relative_humidity_2m),
        windKmh: Math.round(c.wind_speed_10m),
        windFrom: compass(c.wind_direction_10m),
        observedAt: `${c.time}:00Z`,
        source: SOURCES.openMeteo,
      };
    } catch {
      return undefined;
    }
  });
}

export async function getConditions(at: LatLon, placeName: string, regionCode: string | undefined, sensitive: boolean): Promise<Conditions> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [danger, wx, hotspots, perimeters, aqhis, pms] = await Promise.all([
    fireDanger(at),
    weather(at),
    near("hotspot", at, HOTSPOT_KM),
    near("fire-perimeter", at, FIRE_KM),
    near("aqhi", at, AQHI_KM),
    near("pm25", at, PM_KM),
  ]);

  const recent = hotspots.filter((h) => h.observedAt >= dayAgo).sort((a, b) => km(at, a) - km(at, b));
  const fires = perimeters.sort((a, b) => km(at, a) - km(at, b));
  const station = aqhis.sort((a, b) => km(at, a) - km(at, b))[0];
  const freshPm = pms.filter((p) => p.observedAt >= new Date(Date.now() - 2 * 3600 * 1000).toISOString());

  const c: Conditions = {
    at,
    regionCode,
    fireDanger: danger,
    hotspots: {
      count: recent.length,
      nearestKm: recent[0] && r1(km(at, recent[0])),
      latestAt: recent.map((h) => h.observedAt).sort().at(-1),
      radiusKm: HOTSPOT_KM,
      source: SOURCES.firms,
    },
    fires: {
      count: fires.length,
      nearestKm: fires[0] && r1(km(at, fires[0])),
      areaHa: fires[0]?.value,
      lastSeen: fires[0]?.observedAt,
      radiusKm: FIRE_KM,
      source: SOURCES.cwfis,
    },
    weather: wx,
    generatedAt: new Date().toISOString(),
  };
  if (station?.value !== undefined) {
    const cat = aqhiCategory(station.value);
    c.aqhi = {
      value: station.value,
      risk: cat.risk,
      message: sensitive ? cat.atRisk : cat.general,
      station: station.label ?? "Nearest station",
      distanceKm: Math.round(km(at, station)),
      observedAt: station.observedAt,
      source: SOURCES.aqhi,
    };
  }
  if (freshPm.length) {
    const values = freshPm.map((p) => p.value!).sort((a, b) => a - b);
    const median = r1(values[Math.floor(values.length / 2)]!);
    c.pm25 = { median, label: pm25Label(median), sensors: values.length, observedAt: freshPm.map((p) => p.observedAt).sort().at(-1)!, source: SOURCES.purpleair };
  } else {
    c.pm25Note = "No street-level smoke sensors reporting within 10 km.";
  }

  c.summary = await cached(`sum:${gridKey(at)}:${sensitive}`, 30 * 60 * 1000, async () => {
    try {
      const text = await writeSummary(conditionsFacts(c, placeName, sensitive));
      return !findForbiddenClaims(text) && (await isSafeText(text)) ? text : undefined;
    } catch (e) {
      console.warn("Summary failed", e);
      return undefined;
    }
  });
  return c;
}
