import { describe, expect, it } from "vitest";
import { agreedCf1, epaCorrectPm25 } from "./purpleair";

describe("epaCorrectPm25", () => {
  it("brings typical clean-air readings down", () => {
    // 0.524 × 10 − 0.0862 × 40 + 5.75 = 7.54
    expect(epaCorrectPm25(10, 40)).toBe(7.5);
  });

  it("uses the smoke slope in the middle range", () => {
    // 0.786 × 100 − 0.0862 × 30 + 5.75 = 81.76
    expect(epaCorrectPm25(100, 30)).toBe(81.8);
  });

  it("follows the high-concentration curve in heavy smoke", () => {
    // 2.966 + 0.69 × 400 + 0.000884 × 400² = 420.4
    expect(epaCorrectPm25(400, 20)).toBe(420.4);
  });

  it("joins the pieces without jumps", () => {
    for (const edge of [30, 50, 210, 260]) {
      expect(Math.abs(epaCorrectPm25(edge - 0.01, 30) - epaCorrectPm25(edge, 30))).toBeLessThan(0.3);
    }
  });

  it("never goes below zero", () => {
    expect(epaCorrectPm25(0, 95)).toBe(0);
  });
});

describe("agreedCf1", () => {
  it("averages channels that agree", () => {
    expect(agreedCf1(10, 12)).toBe(11);
  });

  it("drops channels that disagree", () => {
    expect(agreedCf1(4, 40)).toBeUndefined();
    expect(agreedCf1(null, 10)).toBeUndefined();
  });
});
