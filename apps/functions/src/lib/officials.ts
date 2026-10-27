// Parsers for official evacuation notices. Pure functions: raw response in, notices out.
import { OFFICIAL_SOURCES, REGION_BBOX, type AreaGeometry, type OfficialNoticeDoc } from "@sylvia/core";

const HOUR = 3600;
const MAX_POINTS = 600;

function bboxOf(area: AreaGeometry): [number, number, number, number] {
  const pts = (area.type === "Polygon" ? [area.coordinates] : area.coordinates).flat(2) as number[][];
  const xs = pts.map((p) => p[0]!);
  const ys = pts.map((p) => p[1]!);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Keep areas well under Cosmos DB's document limit while preserving their outline. */
function simplifyArea(area: AreaGeometry): AreaGeometry {
  const thin = (ring: number[][]) => {
    if (ring.length <= MAX_POINTS) return ring.map(([x, y]) => [round(x!), round(y!)]);
    const step = Math.ceil(ring.length / MAX_POINTS);
    const kept = ring.filter((_, i) => i % step === 0).map(([x, y]) => [round(x!), round(y!)]);
    kept.push(kept[0]!);
    return kept;
  };
  return area.type === "Polygon"
    ? { type: "Polygon", coordinates: area.coordinates.map(thin) }
    : { type: "MultiPolygon", coordinates: area.coordinates.map((poly) => poly.map(thin)) };
}
const round = (n: number) => Math.round(n * 1e5) / 1e5;

function regionFor([w, s, e, n]: [number, number, number, number]): string | undefined {
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  return Object.entries(REGION_BBOX).find(([, [bw, bs, be, bn]]) => cx >= bw && cx <= be && cy >= bs && cy <= bn)?.[0];
}

function doc(base: Omit<OfficialNoticeDoc, "bbox" | "location" | "area" | "regionCode"> & { area: AreaGeometry }, regionCode?: string): OfficialNoticeDoc | undefined {
  const area = simplifyArea(base.area);
  const bbox = bboxOf(area);
  const region = regionCode ?? regionFor(bbox);
  if (!region) return undefined;
  return { ...base, area, bbox, regionCode: region, location: { type: "Point", coordinates: [round((bbox[0] + bbox[2]) / 2), round((bbox[1] + bbox[3]) / 2)] } };
}

interface BcFeature {
  geometry: AreaGeometry | null;
  properties: {
    EMRG_OAA_SYSID: number;
    EVENT_NAME?: string;
    EVENT_TYPE?: string;
    ORDER_ALERT_NAME?: string;
    ORDER_ALERT_STATUS?: string;
    ISSUING_AGENCY?: string;
    DATE_MODIFIED?: number;
  };
}

/** BC Evacuation Orders and Alerts (ArcGIS, f=geojson, outSR=4326). "All Clear" areas are skipped. */
export function parseBcOrders(fc: { features?: BcFeature[] }): OfficialNoticeDoc[] {
  const out: OfficialNoticeDoc[] = [];
  for (const f of fc.features ?? []) {
    const p = f.properties;
    const status = (p.ORDER_ALERT_STATUS ?? "").toLowerCase();
    if (!f.geometry || (status !== "order" && status !== "alert") || !p.ISSUING_AGENCY) continue;
    const d = doc(
      {
        id: `bc:${p.EMRG_OAA_SYSID}:${status}`,
        kind: status,
        agency: p.ISSUING_AGENCY.trim(),
        areaName: (p.ORDER_ALERT_NAME ?? p.EVENT_NAME ?? "the area").trim(),
        event: (p.EVENT_NAME ?? p.EVENT_TYPE ?? "Emergency").trim(),
        issuedAt: new Date(p.DATE_MODIFIED ?? Date.now()).toISOString(),
        url: OFFICIAL_SOURCES.bc.url,
        area: f.geometry,
        source: OFFICIAL_SOURCES.bc,
        ttl: 2 * HOUR, // refreshed every 5 minutes; disappears soon after it's lifted
      },
      "CA-BC",
    );
    if (d) out.push(d);
  }
  return out;
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`))?.[1]?.trim();
const terms = (xml: string) =>
  Object.fromEntries([...xml.matchAll(/<(?:\w+:)?category term="([^"=]+)=([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/**
 * Alert Ready (NAAD) Atom feed. Keeps actual, public, English wildfire or evacuation alerts with an area polygon.
 * An entry is an order when its text says so; otherwise it is relayed as an official alert.
 */
export function parseNaadAtom(xml: string): OfficialNoticeDoc[] {
  const out: OfficialNoticeDoc[] = [];
  for (const [, entry] of xml.matchAll(/<(?:\w+:)?entry>([\s\S]*?)<\/(?:\w+:)?entry>/g)) {
    const t = terms(entry!);
    if (t.status !== "Actual" || t.scope !== "Public" || t.language !== "en-CA" || t.msgType === "Cancel") continue;
    const title = decode(tag(entry!, "title") ?? "");
    const summary = decode(tag(entry!, "summary") ?? "").replace(/<br\s*\/?>/g, "\n");
    const event = t.event ?? "";
    if (!/fire|evacuat/i.test(`${event} ${title}`)) continue;
    const polygons = [...entry!.matchAll(/<(?:\w+:)?polygon>([^<]+)<\/(?:\w+:)?polygon>/g)].map(([, pts]) => {
      const n = pts!.trim().split(/\s+/).map(Number);
      const ring: number[][] = [];
      for (let i = 0; i + 1 < n.length; i += 2) ring.push([n[i + 1]!, n[i]!]); // georss is "lat lon"
      return [ring];
    });
    if (!polygons.length) continue;
    const id = (tag(entry!, "id") ?? title).replace(/[^\w:.-]/g, "_").slice(-180);
    const d = doc({
      id: `naad:${id}`,
      kind: /evacuation order|evacuate now|leave (the area )?(now|immediately)/i.test(`${title}\n${summary}`) ? "order" : "alert",
      agency: decode(tag(tag(entry!, "author") ?? "", "name") ?? "Alert Ready"),
      areaName: summary.match(/Area:\s*([^\n]+)/)?.[1]?.trim() ?? "your area",
      event: event || title,
      issuedAt: new Date(tag(entry!, "updated") ?? Date.now()).toISOString(),
      expiresAt: summary.match(/Expires:\s*([^\n]+)/)?.[1] ? new Date(summary.match(/Expires:\s*([^\n]+)/)![1]!.trim()).toISOString() : undefined,
      url: OFFICIAL_SOURCES.alertReady.url,
      area: polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0]! } : { type: "MultiPolygon", coordinates: polygons },
      source: OFFICIAL_SOURCES.alertReady,
      ttl: 6 * HOUR,
    });
    if (d) out.push(d);
  }
  return out;
}
