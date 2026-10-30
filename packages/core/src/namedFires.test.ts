import { describe, expect, it } from "vitest";
import { matchHeatToFire, matchRadiusKm, type NamedFireRef } from "./namedFires";

const quilpituk: NamedFireRef = { id: "bcws:K51402", name: "Quilpituk Creek wildfire", status: "Out of control", agency: "BC Wildfire Service", at: { lat: 50.2, lon: -119.45 }, areaHa: 5000 };
const small: NamedFireRef = { id: "bcws:K42261", name: "Richlands Road (K42261)", status: "Being held", agency: "BC Wildfire Service", at: { lat: 50.244, lon: -118.678 }, areaHa: 0.01 };

describe("matchRadiusKm", () => {
  it("stays between 3 and 25 km and grows with the fire", () => {
    expect(matchRadiusKm(undefined)).toBe(3);
    expect(matchRadiusKm(5000)).toBeCloseTo(9.5, 0);
    expect(matchRadiusKm(1_000_000)).toBe(25);
  });
});

describe("matchHeatToFire", () => {
  it("links heat near a big fire to it", () => {
    expect(matchHeatToFire({ lat: 50.25, lon: -119.4 }, [quilpituk, small])?.id).toBe("bcws:K51402");
  });

  it("leaves heat unmatched when no fire is close enough", () => {
    expect(matchHeatToFire({ lat: 50.67, lon: -120.33 }, [quilpituk, small])).toBeUndefined();
    // 5 km from a tiny fire is too far for it.
    expect(matchHeatToFire({ lat: 50.289, lon: -118.678 }, [small])).toBeUndefined();
  });
});
