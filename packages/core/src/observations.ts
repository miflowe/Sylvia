/**
 * Environmental observations ingested by the Functions app into the `observations` container, and the official
 * scales used to describe them. Every observation keeps its source and time.
 */

export type ObservationKind = "hotspot" | "fire-perimeter" | "aqhi" | "pm25";

export interface Observation {
  id: string;
  cellId: string;
  kind: ObservationKind;
  source: { name: string; url: string };
  location: { type: "Point"; coordinates: [number, number] };
  observedAt: string; // ISO-8601
  value?: number;
  label?: string;
  props?: Record<string, string | number | boolean>;
  /** Outline for map display (fire perimeters), simplified, WGS84. */
  shape?: { type: "Polygon"; coordinates: number[][][] };
  /** Seconds until Cosmos DB deletes it. */
  ttl: number;
}

export const SOURCES = {
  firms: { name: "NASA FIRMS", url: "https://firms.modaps.eosdis.nasa.gov/" },
  cwfis: { name: "Natural Resources Canada (CWFIS)", url: "https://cwfis.cfs.nrcan.gc.ca/" },
  aqhi: { name: "Environment and Climate Change Canada (AQHI)", url: "https://weather.gc.ca/airquality/pages/index_e.html" },
  purpleair: { name: "PurpleAir sensors", url: "https://map.purpleair.com/" },
  openMeteo: { name: "Open-Meteo", url: "https://open-meteo.com/" },
} as const;

/** Areas polled for street-level PurpleAir readings: [west, south, east, north]. */
export const PILOT_AREAS = [
  { id: "nw-ontario", name: "Northwestern Ontario", regionCode: "CA-ON", bbox: [-95.2, 48.2, -88.5, 51.0] },
  { id: "kamloops-okanagan", name: "Kamloops–Okanagan", regionCode: "CA-BC", bbox: [-120.8, 49.0, -119.0, 51.0] },
] as const;

/** Rough provincial bounds for Ontario and BC: [west, south, east, north]. */
export const REGION_BBOX: Record<string, [number, number, number, number]> = {
  "CA-ON": [-95.2, 41.6, -74.3, 56.9],
  "CA-BC": [-139.1, 48.2, -114.0, 60.0],
};

// CWFIS fire danger classes. GRIDCODE 0 is Low (from the CWFIS legend), not "no data".
export const FIRE_DANGER = ["Low", "Moderate", "High", "Very high", "Extreme"] as const;
export type FireDanger = (typeof FIRE_DANGER)[number];

export function fireDangerFromGridcode(code: number): FireDanger | undefined {
  return FIRE_DANGER[code];
}

/** Official AQHI risk categories and health messages (paraphrased from ECCC), for the general public and at-risk people. */
export interface AqhiCategory {
  risk: "Low" | "Moderate" | "High" | "Very high";
  general: string;
  atRisk: string;
}

export function aqhiCategory(aqhi: number): AqhiCategory {
  const v = Math.round(aqhi);
  if (v <= 3)
    return { risk: "Low", general: "Ideal air quality for outdoor activities.", atRisk: "Enjoy your usual outdoor activities." };
  if (v <= 6)
    return {
      risk: "Moderate",
      general: "No need to change your usual outdoor activities unless you have symptoms like coughing or throat irritation.",
      atRisk: "Consider reducing or rescheduling strenuous activities outdoors if you have symptoms.",
    };
  if (v <= 10)
    return {
      risk: "High",
      general: "Consider reducing or rescheduling strenuous activities outdoors if you have symptoms.",
      atRisk: "Reduce or reschedule strenuous activities outdoors. Children and older adults should also take it easy.",
    };
  return {
    risk: "Very high",
    general: "Reduce or reschedule strenuous activities outdoors, especially if you have symptoms.",
    atRisk: "Avoid strenuous activities outdoors. Children and older adults should also avoid outdoor physical exertion.",
  };
}

/** PM2.5 (µg/m³) described with the US AQI breakpoints PurpleAir maps use; labelled as a sensor reading, not AQHI. */
export function pm25Label(pm: number): string {
  if (pm <= 9) return "Good";
  if (pm <= 35.4) return "Moderate";
  if (pm <= 55.4) return "Unhealthy for sensitive groups";
  if (pm <= 125.4) return "Unhealthy";
  if (pm <= 225.4) return "Very unhealthy";
  return "Hazardous";
}
