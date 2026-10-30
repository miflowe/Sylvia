/**
 * Resident reports: what people near a fire see (smoke, flames, ash, glow). Always labelled unverified, rounded to
 * about 1 km, and gone after 6 hours. They never raise an alert on their own: at most, several independent reports
 * close together add an unverified Level 1 note (see reportsNote).
 */
import type { Alert } from "./alerts";
import { distanceKm, type LatLon } from "./geo";

export type ReportKind = "smoke" | "flames" | "ash" | "glow";

export const REPORT_KINDS: { kind: ReportKind; label: string; hint: string }[] = [
  { kind: "smoke", label: "Smoke", hint: "Smoke in the air or a column on the horizon" },
  { kind: "flames", label: "Flames", hint: "Fire you can see" },
  { kind: "ash", label: "Ash falling", hint: "Ash or embers landing" },
  { kind: "glow", label: "Glow at night", hint: "An orange glow in the sky" },
];

export const REPORT_TTL_SECONDS = 6 * 3600;
export const REPORT_NOTE_MAX = 140;
/** Per device: no more than this many reports per hour and per day. */
export const REPORT_LIMITS = { perHour: 3, perDay: 8 } as const;

/** Official numbers shown before anyone sends a report. */
export const FIRE_LINES = [
  { region: "Everywhere", label: "Emergency", number: "911" },
  { region: "BC", label: "Report a wildfire (BC Wildfire Service)", number: "*5555 on a cell, or 1-800-663-5555" },
  { region: "Ontario", label: "Report a forest fire (Ontario)", number: "310-FIRE (310-3473)" },
] as const;

/** Rounds to 0.01° (about 1 km), so a report never pins someone's house. */
export function roundToKm(p: LatLon): LatLon {
  return { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
}

export interface ResidentReport {
  id: string;
  kind: ReportKind;
  location: LatLon;
  /** One-way hash of the device; only used to count distinct people and to rate-limit. */
  reporter: string;
  createdAt: string;
  note?: string;
  hasPhoto?: boolean;
}

export interface ReportGroup {
  key: string;
  kind: ReportKind;
  location: LatLon;
  people: number;
  latestAt: string;
  notes: string[];
  photoId?: string;
}

/** One map point per place and kind: how many different people reported it, the latest time, a few notes. */
export function groupReports(reports: ResidentReport[]): ReportGroup[] {
  const groups = new Map<string, { r: ResidentReport[] }>();
  for (const r of reports) {
    const p = roundToKm(r.location);
    const key = `${r.kind}:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    groups.set(key, { r: [...(groups.get(key)?.r ?? []), r] });
  }
  return [...groups.entries()].map(([key, { r }]) => {
    const newest = [...r].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      key,
      kind: newest[0]!.kind,
      location: roundToKm(newest[0]!.location),
      people: new Set(r.map((x) => x.reporter)).size,
      latestAt: newest[0]!.createdAt,
      notes: newest.map((x) => x.note).filter((n): n is string => !!n).slice(0, 3),
      photoId: newest.find((x) => x.hasPhoto)?.id,
    };
  });
}

export const REPORTS_NOTE = { people: 3, km: 2, minutes: 60 } as const;

/**
 * An unverified Level 1 note when at least 3 different people reported smoke, flames or glow within 2 km of home in
 * the last hour. Never more than Level 1, and only added when nothing official or satellite-based already covers it.
 */
export function reportsNote(home: LatLon, reports: ResidentReport[], now: string, replay?: boolean): Alert | undefined {
  const since = Date.parse(now) - REPORTS_NOTE.minutes * 60000;
  const near = reports.filter((r) => r.kind !== "ash" && Date.parse(r.createdAt) >= since && Date.parse(r.createdAt) <= Date.parse(now) && distanceKm(home, r.location) <= REPORTS_NOTE.km);
  const people = new Set(near.map((r) => r.reporter)).size;
  if (people < REPORTS_NOTE.people) return undefined;
  const flames = near.some((r) => r.kind === "flames");
  return {
    level: 1,
    title: flames ? "Residents report fire nearby" : "Residents report smoke nearby",
    body: `Check official alerts and watch for smoke. ${people} people within ${REPORTS_NOTE.km} km of your home reported ${flames ? "flames or smoke" : "smoke"} in the last hour. This is not confirmed. If you see flames, call 911.`,
    sources: [{ name: "Sylvia resident reports (unverified)", url: "/map", observedAt: near.map((r) => r.createdAt).sort().at(-1)! }],
    key: `reports:1:${now.slice(0, 13)}`,
    replay: replay || undefined,
  };
}
