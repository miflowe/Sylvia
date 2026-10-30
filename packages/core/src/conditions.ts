import type { FireDanger } from "./observations";

type Src = { name: string; url: string };

/** Everything the Home screen shows for one place. Every part carries its source and time. */
import type { SmokeForecast } from "./smoke";

export interface Conditions {
  at: { lat: number; lon: number };
  regionCode?: string;
  fireDanger: { level: FireDanger; source: Src } | { level: null; reason: string; source: Src };
  aqhi?: { value: number; risk: string; message: string; station: string; distanceKm: number; observedAt: string; source: Src };
  pm25?: { median: number; label: string; sensors: number; observedAt: string; source: Src };
  pm25Note?: string;
  hotspots: { count: number; nearestKm?: number; latestAt?: string; radiusKm: number; source: Src };
  fires: { count: number; nearestKm?: number; areaHa?: number; lastSeen?: string; radiusKm: number; source: Src };
  weather?: { tempC: number; humidity: number; windKmh: number; windFrom: string; observedAt: string; source: Src };
  /** Wildfire smoke forecast for the next 2 days (ECCC FireWork). */
  smoke?: SmokeForecast;
  /** Sylvia's plain-language summary (persona voice; this is not an alert). */
  summary?: string;
  generatedAt: string;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  regionCode?: string;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

/** The facts Sylvia may use in her Home summary. */
export function conditionsFacts(c: Conditions, placeName: string, sensitive: boolean): string {
  const lines = [`Place: ${placeName}.`];
  lines.push(c.fireDanger.level ? `Official fire danger: ${c.fireDanger.level} (Natural Resources Canada).` : `Official fire danger: ${c.fireDanger.reason}.`);
  if (c.aqhi) lines.push(`Air Quality Health Index: ${c.aqhi.value} (${c.aqhi.risk} risk) at ${c.aqhi.station}, ${c.aqhi.distanceKm} km away. Advice: ${c.aqhi.message}`);
  if (c.pm25) lines.push(`Street-level PM2.5 from ${c.pm25.sensors} sensors: ${c.pm25.median} µg/m³ (${c.pm25.label}).`);
  lines.push(
    c.hotspots.count
      ? `Satellite heat detections within ${c.hotspots.radiusKm} km in the last 24 hours: ${c.hotspots.count}, nearest about ${c.hotspots.nearestKm} km. These are unconfirmed and can include other heat sources.`
      : `No satellite heat detections within ${c.hotspots.radiusKm} km in the last 24 hours.`,
  );
  lines.push(
    c.fires.count
      ? `Mapped fire areas within ${c.fires.radiusKm} km this season: ${c.fires.count}, nearest about ${c.fires.nearestKm} km (last active ${c.fires.lastSeen?.slice(0, 10)}).`
      : `No mapped fire areas within ${c.fires.radiusKm} km.`,
  );
  if (c.weather) lines.push(`Weather: ${c.weather.tempC} °C, humidity ${c.weather.humidity}%, wind ${c.weather.windKmh} km/h from the ${c.weather.windFrom}.`);
  if (c.smoke) {
    lines.push(
      c.smoke.level === "none"
        ? "Wildfire smoke forecast (Environment Canada FireWork), next 2 days: no smoke expected."
        : `Wildfire smoke forecast (Environment Canada FireWork), next 2 days: ${c.smoke.level}, peaking near ${c.smoke.peakUgm3} µg/m³ at ${c.smoke.peakAt}, starting around ${c.smoke.firstAt}.`,
    );
  }
  if (sensitive) lines.push("The person is sensitive to smoke.");
  return lines.join("\n");
}
