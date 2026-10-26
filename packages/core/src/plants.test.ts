import { describe, expect, it } from "vitest";
import { findForbiddenClaims, RegionVerdictSchema, speciesIdFor, vascanVerdict } from "./index";

const verdict = {
  id: "CA-ON:berberis-thunbergii",
  regionCode: "CA-ON",
  speciesId: "berberis-thunbergii",
  status: "invasive",
  harm: "Spreads into woodlands and crowds out native shrubs.",
  statusSource: { name: "Ontario Invasive Plant Council" },
  flammability: { rating: "not-rated" },
  confidence: "curated",
  review: { status: "draft" },
};

describe("plant schemas", () => {
  it("makes stable species ids", () => {
    expect(speciesIdFor(" Berberis thunbergii ")).toBe("berberis-thunbergii");
    expect(speciesIdFor("Physocarpus opulifolius var. intermedius")).toBe("physocarpus-opulifolius-var-intermedius");
  });
  it("accepts a valid draft verdict", () => {
    expect(RegionVerdictSchema.safeParse(verdict).success).toBe(true);
  });
  it("requires a harm note for invasive plants", () => {
    expect(RegionVerdictSchema.safeParse({ ...verdict, harm: undefined }).success).toBe(false);
  });
  it("requires a source for any flammability rating", () => {
    expect(RegionVerdictSchema.safeParse({ ...verdict, flammability: { rating: "high" } }).success).toBe(false);
  });
  it("requires a reviewer on reviewed rows", () => {
    expect(RegionVerdictSchema.safeParse({ ...verdict, review: { status: "reviewed" } }).success).toBe(false);
  });
  it("flags forbidden claims", () => {
    expect(findForbiddenClaims("A fireproof hedge")).toBe("fireproof");
    expect(findForbiddenClaims("Lower flammability when watered")).toBeUndefined();
  });
});

describe("VASCAN fallback", () => {
  const fake = (routes: Record<string, unknown>) => async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    return { ok: !!key, json: async () => (key ? routes[key] : {}) };
  };
  it("reads the province's establishment means", async () => {
    const v = await vascanVerdict(
      "Berberis thunbergii",
      "CA-ON",
      fake({
        "species/search": { results: [{ key: 1, canonicalName: "Berberis thunbergii" }] },
        "species/1/distributions": { results: [{ locationId: "ISO3166-2:CA-ON", establishmentMeans: "INTRODUCED" }] },
      }),
    );
    expect(v).toMatchObject({ status: "introduced", confidence: "lower" });
  });
  it("returns unknown when the name doesn't match exactly", async () => {
    const v = await vascanVerdict(
      "Berberis",
      "CA-ON",
      fake({ "species/search": { results: [{ key: 1, canonicalName: "Berberis thunbergii" }] } }),
    );
    expect(v.status).toBe("unknown");
  });
});
