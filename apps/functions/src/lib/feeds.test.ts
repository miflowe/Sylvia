import { describe, expect, it } from "vitest";
import { parseAqhi, parseBcFires, parseCwfisPerimeters, parseFirmsCsv, parseOntarioFires, parsePurpleAir } from "./feeds";

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
  it("applies the US EPA correction and drops sensors that fail the channel check", () => {
    const obs = parsePurpleAir({
      fields: ["sensor_index", "last_seen", "latitude", "longitude", "pm2.5_cf_1_a", "pm2.5_cf_1_b", "humidity"],
      data: [
        [1, 1793000000, 50.67, -120.33, 10, 10, 40], // 0.524 × 10 − 0.0862 × 40 + 5.75 = 7.5
        [2, 1793000000, 50.6, -120.3, 4, 40, 40], // channels disagree
        [3, 1793000000, null, -120.3, 5, 5, 40], // no location
        [4, 1793000000, 50.6, -120.3, 5, 5, null], // no humidity
      ],
    });
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ id: "purpleair:1", value: 7.5, kind: "pm25", props: { corrected: "US EPA" } });
  });
});

describe("named fires", () => {
  it("reads BC fires, names them, and skips fires that are out", () => {
    const obs = parseBcFires({
      features: [
        { geometry: { type: "Point", coordinates: [-119.51, 50.2] }, properties: { FIRE_NUMBER: "K51402", INCIDENT_NAME: "Quilpituk Creek", FIRE_STATUS: "Out of Control", CURRENT_SIZE: 1520.4, FIRE_URL: "https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=2026&incidentNumber=K51402", FIRE_OF_NOTE_IND: "Y" } },
        { geometry: { type: "Point", coordinates: [-118.68, 50.24] }, properties: { FIRE_NUMBER: "K42261", INCIDENT_NAME: "K42261", GEOGRAPHIC_DESCRIPTION: "Richlands Road", FIRE_STATUS: "Being Held", CURRENT_SIZE: 0.009 } },
        { geometry: { type: "Point", coordinates: [-121.75, 57.39] }, properties: { FIRE_NUMBER: "G80405", FIRE_STATUS: "Out" } },
      ],
    });
    expect(obs.map((o) => [o.label, o.props?.status])).toEqual([
      ["Quilpituk Creek wildfire", "Out of control"],
      ["Richlands Road (K42261)", "Being held"],
    ]);
    expect(obs[0]).toMatchObject({ kind: "named-fire", value: 1520.4, props: { fireNumber: "K51402", ofNote: true } });
  });

  it("reads Ontario fires and turns district codes into names", () => {
    const obs = parseOntarioFires({
      features: [
        { geometry: { type: "Point", coordinates: [-89.1, 48.74] }, properties: { FIELD_AGENCY_FIRE_ID: "THU_FIRE_091", FIELD_STAGE_OF_CONTROL_STATUS: "BM", FIELD_FIRE_SIZE: 0.1 } },
        { geometry: { type: "Point", coordinates: [-93.8, 51.0] }, properties: { FIELD_AGENCY_FIRE_ID: "RED_FIRE_012", FIELD_STAGE_OF_CONTROL_STATUS: "UC", FIELD_FIRE_SIZE: 42 } },
        { geometry: { type: "Point", coordinates: [-82.55, 46.17] }, properties: { FIELD_AGENCY_FIRE_ID: "CHA_FIRE_029", FIELD_STAGE_OF_CONTROL_STATUS: "EX" } },
      ],
    });
    expect(obs.map((o) => [o.label, o.props?.status])).toEqual([
      ["Thunder Bay 91", "Being monitored"],
      ["Red Lake 12", "Under control"],
    ]);
  });
});
