/** ISO 3166-2 style region codes. Every record is keyed by one, so new regions are data, not schema. */
export type RegionCode = `${"CA" | "US"}-${string}`;

export const PILOT_REGIONS = ["CA-ON", "CA-BC"] as const satisfies readonly RegionCode[];
export type PilotRegion = (typeof PILOT_REGIONS)[number];

export function isPilotRegion(code: string): code is PilotRegion {
  return (PILOT_REGIONS as readonly string[]).includes(code);
}

/** Outside pilots we fall back to GBIF/GRIIS data and say so. */
export function verdictConfidence(code: RegionCode): "curated" | "lower" {
  return isPilotRegion(code) ? "curated" : "lower";
}
