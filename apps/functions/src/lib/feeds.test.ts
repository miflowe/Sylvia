import { describe, expect, it } from "vitest";
import { parseAqhi, parseCwfisPerimeters, parseFirmsCsv, parsePurpleAir } from "./feeds";

describe("FIRMS", () => {
  const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
50.67123,-120.34567,330.1,0.4,0.4,2026-08-01,631,N20,VIIRS,h,2.0NRT,290.1,12.5,N
bad,row`;
  it("parses rows into hotspots with UTC times", () => {
    const [h, ...rest] = parseFirmsCsv(csv);
    expect(rest).toHaveLength(0);
    expect(h).toMatchObject({ kind: "hotspot", observedAt: "2026-08-01T06:31:00Z", value: 12.5, cellId: "50.6:-120.4" });
    expect(h!.location.coordinates).toEqual([-120.3457, 50.6712]);
  });
  it("returns nothing for an error message", () => {
    expect(parseFirmsCsv("Invalid MAP_KEY.")).toEqual([]);
  });
});

describe("CWFIS perimeters", () => {
  it("uses the centroid and keeps a closed, simplified outline", () => {
    const ring = Array.from({ length: 1000 }, (_, i) => [-120 + Math.cos((i / 1000) * 2 * Math.PI) * 0.1, 50 + Math.sin((i / 1000) * 2 * Math.PI) * 0.1]);
    ring.push(ring[0]!);
    const [p] = parseCwfisPerimeters({
      features: [{ id: "m3.1", geometry: { type: "Polygon", coordinates: [ring] }, properties: { firstdate: "2026-07-15", lastdate: "2026-08-26T21:12:00Z", area: 2216.3, hcount: 881 } }],
    });
    expect(p!.kind).toBe("fire-perimeter");
    expect(p!.location.coordinates[0]).toBeCloseTo(-120, 1);
    expect(p!.shape!.coordinates[0]!.length).toBeLessThanOrEqual(402);
    expect(p!.value).toBe(2216.3);
  });
});

describe("AQHI", () => {
  it("keeps the latest reading per station and skips nulls", () => {
    const obs = parseAqhi({
      features: [
        { geometry: { type: "Point", coordinates: [-79.4, 43.7] }, properties: { location_id: "FCKTB", location_name_en: "Toronto West", aqhi: 2.41, observation_datetime: "2026-10-26T20:00:00Z" } },
        { geometry: { type: "Point", coordinates: [-79.4, 43.7] }, properties: { location_id: "FCKTB", location_name_en: "Toronto West", aqhi: 2.9, observation_datetime: "2026-10-26T21:00:00Z" } },
        { geometry: { type: "Point", coordinates: [-80, 44] }, properties: { location_id: "X", location_name_en: "Nowhere", aqhi: null, observation_datetime: "2026-10-26T21:00:00Z" } },
      ],
    });
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ value: 2.9, label: "Toronto West" });
  });
});

describe("PurpleAir", () => {
  it("maps fields by name and drops broken sensors", () => {
    const obs = parsePurpleAir({
      fields: ["sensor_index", "last_seen", "latitude", "longitude", "pm2.5_10minute"],
      data: [
        [1, 1793000000, 50.67, -120.33, 12.34],
        [2, 1793000000, 50.6, -120.3, 4000],
        [3, 1793000000, null, -120.3, 5],
      ],
    });
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ id: "purpleair:1", value: 12.3, kind: "pm25" });
  });
});
