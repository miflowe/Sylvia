import { describe, expect, it } from "vitest";
import { assertAlertAuthority, AlertAuthorityError, describeFlammability, verdictConfidence, verificationLabel } from "./index";

const src = [{ name: "NASA FIRMS", observedAt: "2026-08-01T12:00:00Z" }];

describe("alert authority", () => {
  it("rejects Level 3 without an issuing agency", () => {
    expect(() => assertAlertAuthority({ level: 3, title: "Order", body: "", sources: src })).toThrow(AlertAuthorityError);
  });
  it("rejects alerts with no source", () => {
    expect(() => assertAlertAuthority({ level: 1, title: "Smoke", body: "", sources: [] })).toThrow(AlertAuthorityError);
  });
  it("labels our advisories unverified", () => {
    expect(verificationLabel({ level: 2, title: "Smoke", body: "", sources: src })).toMatch(/Unverified/);
  });
  it("accepts a relayed official order", () => {
    const a = { level: 3 as const, title: "Evacuation order", body: "", sources: src, issuingAgency: "BC Wildfire Service" };
    expect(() => assertAlertAuthority(a)).not.toThrow();
    expect(verificationLabel(a)).toBe("Official order · BC Wildfire Service");
  });
});

describe("flammability", () => {
  it("never claims fireproof and falls back to not rated", () => {
    expect(describeFlammability({ rating: "low" })).toBe("Flammability not rated");
    expect(describeFlammability({ rating: "low", source: "FireSmart BC" })).not.toMatch(/fireproof/i);
  });
  it("notes borrowed ratings", () => {
    expect(describeFlammability({ rating: "high", source: "FireSmart BC", appliedFromRegion: "BC" })).toContain("rating from BC");
  });
});

describe("regions", () => {
  it("marks non-pilot regions lower confidence", () => {
    expect(verdictConfidence("CA-ON")).toBe("curated");
    expect(verdictConfidence("CA-AB")).toBe("lower");
  });
});
