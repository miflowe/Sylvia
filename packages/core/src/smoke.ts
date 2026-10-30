/**
 * Wildfire smoke forecast for one place, from Environment and Climate Change Canada's FireWork system (the
 * wildfire-smoke part of surface PM2.5 in the RAQDPS model). Turns hourly values into one plain line for Home.
 * A forecast, not an alert: wording says "forecast" and always carries the source and issue time.
 */
export interface SmokePoint {
  at: string;
  /** PM2.5 from wildfire smoke, µg/m³. */
  ugm3: number;
}

export type SmokeLevel = "none" | "light" | "moderate" | "heavy";

/** µg/m³ of smoke PM2.5. Moderate and heavy match Sylvia's PM2.5 alert thresholds (sensitive and general). */
export const SMOKE_THRESHOLDS = { light: 10, moderate: 20, heavy: 35.5 } as const;

export const FIREWORK_SOURCE = { name: "Environment and Climate Change Canada (FireWork smoke forecast)", url: "https://weather.gc.ca/firework/index_e.html" } as const;

export interface SmokeForecast {
  level: SmokeLevel;
  peakUgm3: number;
  peakAt?: string;
  /** First forecast hour at or above the level's threshold. */
  firstAt?: string;
  points: SmokePoint[];
  /** Model run the forecast comes from. */
  issuedAt: string;
  source: { name: string; url: string };
}

const levelOf = (ugm3: number): SmokeLevel =>
  ugm3 >= SMOKE_THRESHOLDS.heavy ? "heavy" : ugm3 >= SMOKE_THRESHOLDS.moderate ? "moderate" : ugm3 >= SMOKE_THRESHOLDS.light ? "light" : "none";

export function smokeOutlook(points: SmokePoint[], issuedAt: string): SmokeForecast {
  const sorted = [...points].sort((a, b) => a.at.localeCompare(b.at));
  const peak = sorted.reduce<SmokePoint | undefined>((best, p) => (!best || p.ugm3 > best.ugm3 ? p : best), undefined);
  const level = levelOf(peak?.ugm3 ?? 0);
  const threshold = level === "none" ? Infinity : SMOKE_THRESHOLDS[level];
  return {
    level,
    peakUgm3: Math.round((peak?.ugm3 ?? 0) * 10) / 10,
    peakAt: level === "none" ? undefined : peak?.at,
    firstAt: sorted.find((p) => p.ugm3 >= threshold)?.at,
    points: sorted,
    issuedAt,
    source: FIREWORK_SOURCE,
  };
}

/** Local time zone for a pilot place: BC is Pacific; Ontario west of 90°W (Kenora, Dryden) is Central. */
export function timeZoneFor(lon: number, regionCode?: string): string {
  if (regionCode === "CA-BC") return "America/Vancouver";
  if (regionCode === "CA-ON") return lon < -90 ? "America/Winnipeg" : "America/Toronto";
  return lon < -114 ? "America/Vancouver" : lon < -102 ? "America/Edmonton" : lon < -90 ? "America/Winnipeg" : lon < -64 ? "America/Toronto" : "America/Halifax";
}

/** "this afternoon", "tonight", "tomorrow morning", "on Saturday evening", in the place's own time zone. */
export function whenPhrase(iso: string, now: string, timeZone: string): string {
  const parts = (d: string) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "long" })
        .formatToParts(new Date(d))
        .map((x) => [x.type, x.value]),
    );
    return { day: Date.UTC(+p.year!, +p.month! - 1, +p.day!), hour: +p.hour!, weekday: p.weekday! };
  };
  const at = parts(iso);
  const today = parts(now);
  const days = Math.round((at.day - today.day) / 86400000);
  const part = at.hour < 5 ? "overnight" : at.hour < 12 ? "morning" : at.hour < 17 ? "afternoon" : at.hour < 21 ? "evening" : "night";
  if (days <= 0) return part === "overnight" || part === "night" ? "tonight" : `this ${part}`;
  if (days === 1) return part === "overnight" ? "overnight tonight" : `tomorrow ${part}`;
  return `on ${at.weekday} ${part === "overnight" ? "night" : part}`;
}

/** One line for Home. Impersonal: it relays a government forecast. */
export function smokeLine(f: SmokeForecast, placeName: string, now: string, timeZone: string, sensitive: boolean): string {
  const when = f.firstAt ? whenPhrase(f.firstAt, now, timeZone) : "";
  switch (f.level) {
    case "none":
      return `No wildfire smoke is forecast for ${placeName} in the next 2 days.`;
    case "light":
      return `Light wildfire smoke is possible in ${placeName} ${when}.`;
    case "moderate":
      return `Wildfire smoke is forecast to reach ${placeName} ${when}.${sensitive ? " Plan more time indoors with windows closed then." : ""}`;
    case "heavy":
      return `Heavy wildfire smoke is forecast for ${placeName} ${when}. Plan to keep windows closed and limit time outdoors.`;
  }
}
