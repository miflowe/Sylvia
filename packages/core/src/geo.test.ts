import { describe, expect, it } from "vitest";
import { cellIdFor, distanceKm, isValidLatLon, matchCurated, pointInArea, roundForSighting } from "./geo";

describe("geo", () => {
  it("rounds sightings to about 1 km", () => {
    expect(roundForSighting({ lat: 43.65789, lon: -79.38123 })).toEqual({ lat: 43.66, lon: -79.38 });
  });
  it("builds ~11 km partition cells", () => {
    expect(cellIdFor({ lat: 43.6578, lon: -79.3812 })).toBe("43.6:-79.4");
    expect(cellIdFor({ lat: 49.28, lon: -123.12 })).toBe("49.2:-123.2");
  });
  it("validates coordinates", () => {
    expect(isValidLatLon({ lat: 43.6, lon: -79.4 })).toBe(true);
    expect(isValidLatLon({ lat: 120, lon: 0 })).toBe(false);
    expect(isValidLatLon({ lat: 43.6 })).toBe(false);
  });
  it("measures distance", () => {
    expect(distanceKm({ lat: 43.6532, lon: -79.3832 }, { lat: 45.4215, lon: -75.6972 })).toBeCloseTo(352, -1);
  });
  it("matches curated nurseries by place or distinctive name", () => {
    const curated = [{ name: "Sheridan Nurseries", location: { lat: 43.7, lon: -79.4 } }];
    expect(matchCurated({ name: "Anything", location: { lat: 43.7005, lon: -79.4005 } }, curated)).toBeDefined();
    expect(matchCurated({ name: "Sheridan Nurseries Garden Centre", location: { lat: 43.71, lon: -79.4 } }, curated)).toBeDefined();
    expect(matchCurated({ name: "Other Garden Centre", location: { lat: 43.71, lon: -79.4 } }, curated)).toBeUndefined();
  });
});

describe("pointInArea", () => {
  const square = [[[-120, 50], [-119, 50], [-119, 51], [-120, 51], [-120, 50]]];
  it("finds points inside and outside, either winding", () => {
    expect(pointInArea({ lat: 50.5, lon: -119.5 }, { type: "Polygon", coordinates: square })).toBe(true);
    expect(pointInArea({ lat: 52, lon: -119.5 }, { type: "Polygon", coordinates: square })).toBe(false);
    expect(pointInArea({ lat: 50.5, lon: -119.5 }, { type: "Polygon", coordinates: [square[0]!.slice().reverse()] })).toBe(true);
  });
  it("respects holes and multipolygons", () => {
    const hole = [[-119.6, 50.4], [-119.4, 50.4], [-119.4, 50.6], [-119.6, 50.6], [-119.6, 50.4]];
    expect(pointInArea({ lat: 50.5, lon: -119.5 }, { type: "Polygon", coordinates: [square[0]!, hole] })).toBe(false);
    expect(pointInArea({ lat: 50.5, lon: -119.5 }, { type: "MultiPolygon", coordinates: [[hole], square] })).toBe(true);
  });
});
