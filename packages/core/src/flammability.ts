/** Flammability ratings come only from cited sources (FireSmart BC / FireSmart Canada). Never "fireproof". */
export type FlammabilityRating = "low" | "moderate" | "high" | "not-rated";

export interface FlammabilityRecord {
  rating: FlammabilityRating;
  source?: string; // required unless not-rated
  appliedFromRegion?: string; // e.g. a BC rating applied to the same species in Ontario
}

export function describeFlammability(rec: FlammabilityRecord): string {
  if (rec.rating === "not-rated" || !rec.source) return "Flammability not rated";
  const borrowed = rec.appliedFromRegion ? ` (rating from ${rec.appliedFromRegion})` : "";
  const label = { low: "Lower flammability", moderate: "Moderate flammability", high: "Highly flammable" }[rec.rating];
  return `${label} · ${rec.source}${borrowed}`;
}
