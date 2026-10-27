/**
 * Alert rules: turn nearby observations and official notices into alerts for one home. Pure and deterministic,
 * so the same code runs on live data and in Replay mode. Wording follows the emergency voice: instruction first,
 * then the reason; no persona; plain words.
 */
import { assertAlertAuthority, type Alert } from "./alerts";
import { compass } from "./conditions";
import { distanceKm, type LatLon } from "./geo";
import { aqhiCategory, SOURCES } from "./observations";

export interface OfficialNotice {
  id: string;
  kind: "order" | "alert";
  agency: string;
  areaName: string;
  issuedAt: string;
  url?: string;
  /** True when the home is inside the notice's area. */
  coversHome: boolean;
  source: { name: string; url: string };
}

export interface RuleInput {
  now: string;
  home: LatLon;
  sensitive: boolean;
  hotspots: { location: LatLon; observedAt: string }[];
  aqhi?: { value: number; station: string; observedAt: string };
  pm25?: { median: number; sensors: number; observedAt: string };
  officials: OfficialNotice[];
  replay?: boolean;
}

export const THRESHOLDS = {
  warningKm: 10, // L2: two or more detections this close in the last 6 h
  advisoryKm: 25, // L1: any detection this close in the last 12 h
  aqhi: { general: 7, sensitive: 4 },
  pm25: { general: 35.5, sensitive: 20 },
} as const;

const HOUR = 3600 * 1000;

function bearing(from: LatLon, to: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const day = (iso: string) => iso.slice(0, 10);
const hoursAgo = (now: string, iso: string) => Math.max(1, Math.round((Date.parse(now) - Date.parse(iso)) / HOUR));
const hours = (n: number) => `${n} hour${n === 1 ? "" : "s"}`;

export function evaluateAlerts(input: RuleInput): Alert[] {
  const { now, home, sensitive } = input;
  const out: Alert[] = [];
  const replay = input.replay || undefined;

  // Official notices covering the home: orders at Level 3, alerts at Level 2. Relayed, never reworded into advice.
  for (const n of input.officials.filter((o) => o.coversHome)) {
    out.push(
      n.kind === "order"
        ? {
            level: 3,
            title: "Evacuation order",
            body: `${n.agency} has issued an evacuation order for ${n.areaName}, which includes your home area. Follow their instructions now.`,
            official: true,
            issuingAgency: n.agency,
            url: n.url,
            sources: [{ name: n.source.name, url: n.source.url, observedAt: n.issuedAt }],
            key: `official:${n.id}:order`,
            replay,
          }
        : {
            level: 2,
            title: "Evacuation alert",
            body: `${n.agency} has issued an evacuation alert for ${n.areaName}, which includes your home area. Be ready to leave on short notice and follow their instructions.`,
            official: true,
            issuingAgency: n.agency,
            url: n.url,
            sources: [{ name: n.source.name, url: n.source.url, observedAt: n.issuedAt }],
            key: `official:${n.id}:alert`,
            replay,
          },
    );
  }

  // Satellite heat near home. Unverified: it can be a controlled burn or another heat source.
  const recent = input.hotspots
    .map((h) => ({ ...h, km: distanceKm(home, h.location), age: Date.parse(now) - Date.parse(h.observedAt) }))
    .filter((h) => h.age >= 0)
    .sort((a, b) => a.km - b.km);
  const close = recent.filter((h) => h.km <= THRESHOLDS.warningKm && h.age <= 6 * HOUR);
  const near = recent.filter((h) => h.km <= THRESHOLDS.advisoryKm && h.age <= 12 * HOUR);
  const hasOfficialOrder = out.some((a) => a.level === 3);
  if (close.length >= 2 && !hasOfficialOrder) {
    const h = close[0]!;
    out.push({
      level: 2,
      title: "Fire activity near you",
      body: `Be ready to leave if officials tell you to. Satellites detected heat ${Math.round(h.km)} km ${compass(bearing(home, h.location))} of your home in the last ${hours(hoursAgo(now, h.observedAt))} (${close.length} detections). This is not confirmed. Check official alerts.`,
      sources: [{ name: SOURCES.firms.name, url: SOURCES.firms.url, observedAt: h.observedAt }],
      key: `hotspot:2:${day(now)}`,
      replay,
    });
  } else if (near.length >= 1 && !hasOfficialOrder) {
    const h = near[0]!;
    out.push({
      level: 1,
      title: "Heat detected nearby",
      body: `Watch for smoke and check official alerts. Satellites detected heat ${Math.round(h.km)} km ${compass(bearing(home, h.location))} of your home about ${hours(hoursAgo(now, h.observedAt))} ago. It may be a controlled burn or another heat source.`,
      sources: [{ name: SOURCES.firms.name, url: SOURCES.firms.url, observedAt: h.observedAt }],
      key: `hotspot:1:${day(now)}`,
      replay,
    });
  }

  // Smoke: official AQHI, then street-level sensors.
  const aqhiLimit = sensitive ? THRESHOLDS.aqhi.sensitive : THRESHOLDS.aqhi.general;
  if (input.aqhi && input.aqhi.value >= aqhiLimit) {
    const cat = aqhiCategory(input.aqhi.value);
    out.push({
      level: 1,
      title: "Smoky air",
      body: `${sensitive ? cat.atRisk : cat.general} The Air Quality Health Index is ${input.aqhi.value} (${cat.risk.toLowerCase()} risk) at ${input.aqhi.station}.`,
      sources: [{ name: SOURCES.aqhi.name, url: SOURCES.aqhi.url, observedAt: input.aqhi.observedAt }],
      key: `aqhi:${cat.risk}:${day(now)}`,
      replay,
    });
  } else {
    const pmLimit = sensitive ? THRESHOLDS.pm25.sensitive : THRESHOLDS.pm25.general;
    if (input.pm25 && input.pm25.median >= pmLimit) {
      out.push({
        level: 1,
        title: "Smoke nearby",
        body: `Keep windows closed and limit time outside${sensitive ? ", especially with your health condition" : ""}. Nearby sensors show PM2.5 at ${input.pm25.median} µg/m³ (median of ${input.pm25.sensors}).`,
        sources: [{ name: `${input.pm25.sensors} PurpleAir sensors`, url: SOURCES.purpleair.url, observedAt: input.pm25.observedAt }],
        key: `pm25:${day(now)}`,
        replay,
      });
    }
  }

  out.forEach(assertAlertAuthority);
  return out.sort((a, b) => b.level - a.level);
}
