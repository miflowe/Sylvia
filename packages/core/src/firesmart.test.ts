import { describe, expect, it } from "vitest";
import { CHECKLIST, checklistProgress, communityFor, findForbiddenClaims, safeCount } from "./index";

describe("FireSmart checklist", () => {
  it("has unique ids and never claims anything is fireproof", () => {
    expect(new Set(CHECKLIST.map((i) => i.id)).size).toBe(CHECKLIST.length);
    for (const i of CHECKLIST) expect(findForbiddenClaims(`${i.text} ${i.why}`)).toBeUndefined();
  });
  it("computes progress", () => {
    expect(checklistProgress({})).toMatchObject({ done: 0, percent: 0 });
    expect(checklistProgress({ "gutters-clear": true, "lawn-short": true, unknown: true }).done).toBe(2);
  });
});

describe("communities", () => {
  it("places Kelowna in Central Okanagan and Kamloops outside it", () => {
    expect(communityFor({ lat: 49.888, lon: -119.496 })?.id).toBe("central-okanagan");
    expect(communityFor({ lat: 50.67, lon: -120.33 })).toBeUndefined();
  });
  it("hides small counts", () => {
    expect(safeCount(3)).toBe("fewer than 5");
    expect(safeCount(12)).toBe(12);
  });
});
