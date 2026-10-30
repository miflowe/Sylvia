// One function per feed. Each fetches, parses, and upserts; failures are logged and never throw past the timer.
import { PILOT_AREAS, REGION_BBOX, type Observation } from "@sylvia/core";
import { parseAqhi, parseCwfisPerimeters, parseFirmsCsv, parsePurpleAir } from "./feeds";
import { upsertObservations } from "./store";

export interface IngestResult {
  feed: string;
  fetched: number;
  failed: number;
  note?: string;
}

const UA = { "user-agent": "Sylvia/0.1 (Imagine Cup student project; github.com/miflowe/Sylvia)" };
const regionBoxes = Object.values(REGION_BBOX);

async function store(feed: string, items: Observation[], note?: string): Promise<IngestResult> {
  const failed = await upsertObservations(items);
  return { feed, fetched: items.length, failed, note };
}

/** VIIRS hotspots from the three satellites, last 24 h, Ontario and BC. */
export async function ingestFirms(): Promise<IngestResult> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { feed: "firms", fetched: 0, failed: 0, note: "FIRMS_MAP_KEY not set" };
  const items: Observation[] = [];
  for (const sat of ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "VIIRS_SNPP_NRT"]) {
    for (const [w, s, e, n] of regionBoxes) {
      const res = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${sat}/${w},${s},${e},${n}/1`, { headers: UA });
      if (res.ok) items.push(...parseFirmsCsv(await res.text()));
    }
  }
  return store("firms", items);
}

/** Satellite-derived fire perimeters from CWFIS, Ontario and BC. */
export async function ingestCwfis(): Promise<IngestResult> {
  const items: Observation[] = [];
  for (const [w, s, e, n] of regionBoxes) {
    const url =
      "https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=2.0.0&request=GetFeature" +
      `&typeNames=public:m3_polygons_current&outputFormat=application/json&srsName=EPSG:4326&bbox=${w},${s},${e},${n},EPSG:4326`;
    const res = await fetch(url, { headers: UA });
    if (res.ok) items.push(...parseCwfisPerimeters(await res.json()));
  }
  return store("cwfis", items);
}

/** Latest AQHI observations for stations in Ontario and BC. */
export async function ingestAqhi(): Promise<IngestResult> {
  const items: Observation[] = [];
  for (const [w, s, e, n] of regionBoxes) {
    const url = `https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?f=json&latest=true&limit=1000&bbox=${w},${s},${e},${n}`;
    const res = await fetch(url, { headers: UA });
    if (res.ok) items.push(...parseAqhi(await res.json()));
  }
  return store("aqhi", items);
}

/** Street-level PM2.5 from PurpleAir, pilot areas only (each sensor read costs API points). */
export async function ingestPurpleAir(): Promise<IngestResult> {
  const key = process.env.PURPLEAIR_API_KEY;
  if (!key || key === "not-set") return { feed: "purpleair", fetched: 0, failed: 0, note: "PURPLEAIR_API_KEY not set" };
  const items: Observation[] = [];
  for (const area of PILOT_AREAS) {
    const [w, s, e, n] = area.bbox;
    const params = new URLSearchParams({
      fields: "pm2.5_cf_1_a,pm2.5_cf_1_b,humidity,latitude,longitude,last_seen",
      location_type: "0", // outdoor
      max_age: "3600",
      nwlng: String(w),
      nwlat: String(n),
      selng: String(e),
      selat: String(s),
    });
    const res = await fetch(`https://api.purpleair.com/v1/sensors?${params}`, { headers: { ...UA, "X-API-Key": key } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { feed: "purpleair", fetched: 0, failed: 0, note: `PurpleAir ${res.status} ${body.error ?? ""}`.trim() };
    }
    items.push(...parsePurpleAir(await res.json()));
  }
  return store("purpleair", items);
}

export const FEEDS = { firms: ingestFirms, cwfis: ingestCwfis, aqhi: ingestAqhi, purpleair: ingestPurpleAir };
