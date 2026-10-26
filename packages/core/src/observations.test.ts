import { describe, expect, it } from "vitest";
import { aqhiCategory, fireDangerFromGridcode, pm25Label } from "./observations";

describe("official scales", () => {
  it("maps CWFIS GRIDCODE 0 to Low and 4 to Extreme", () => {
    expect(fireDangerFromGridcode(0)).toBe("Low");
    expect(fireDangerFromGridcode(1)).toBe("Moderate");
    expect(fireDangerFromGridcode(4)).toBe("Extreme");
    expect(fireDangerFromGridcode(9)).toBeUndefined();
  });
  it("uses AQHI risk bands", () => {
    expect(aqhiCategory(2.4).risk).toBe("Low");
    expect(aqhiCategory(3.6).risk).toBe("Moderate");
    expect(aqhiCategory(7).risk).toBe("High");
    expect(aqhiCategory(11).risk).toBe("Very high");
  });
  it("labels PM2.5 readings", () => {
    expect(pm25Label(5)).toBe("Good");
    expect(pm25Label(40)).toBe("Unhealthy for sensitive groups");
  });
});
