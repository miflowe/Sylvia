import { describe, expect, it } from "vitest";
import { binomialKey, mergeIdentifications } from "./identify";

describe("binomialKey", () => {
  it("ignores authors and subspecies", () => {
    expect(binomialKey("Berberis thunbergii DC.")).toBe("berberis thunbergii");
    expect(binomialKey("Phragmites australis subsp. australis")).toBe("phragmites australis");
    expect(binomialKey("Acer × freemanii")).toBe("acer freemanii");
  });
});

describe("mergeIdentifications", () => {
  it("is high confidence when both sources agree strongly", () => {
    const r = mergeIdentifications(
      [{ scientificName: "Berberis thunbergii", commonName: "Japanese barberry", score: 0.9 }],
      [{ scientificName: "Berberis thunbergii DC.", score: 0.8, gbifKey: 3033868 }],
    );
    expect(r).toMatchObject({ level: "high", agreement: true, needsConfirmation: false });
    expect(r.top).toMatchObject({ key: "berberis thunbergii", commonName: "Japanese barberry", gbifKey: 3033868 });
    expect(r.top!.score).toBeCloseTo(0.85);
  });

  it("asks for confirmation when the sources disagree", () => {
    const r = mergeIdentifications(
      [{ scientificName: "Euonymus alatus", score: 0.7 }],
      [{ scientificName: "Aronia melanocarpa", score: 0.6 }],
    );
    expect(r.agreement).toBe(false);
    expect(r.needsConfirmation).toBe(true);
    expect(r.alternatives).toHaveLength(1);
  });

  it("discounts a single-source answer", () => {
    const r = mergeIdentifications([{ scientificName: "Vinca minor", score: 0.9 }], []);
    expect(r.top!.score).toBeCloseTo(0.54);
    expect(r.level).toBe("medium");
  });

  it("handles no answers and genus-only answers", () => {
    expect(mergeIdentifications([], []).top).toBeUndefined();
    expect(mergeIdentifications([{ scientificName: "Acer", score: 0.9 }], []).top).toBeUndefined();
  });
});
