import { describe, expect, it } from "vitest";
import { nodeObservation } from "./nodes";

const msg = { v: 1, seq: 7, up: 3600, pm25: 18.4, co2: 512, co: 1.25, t: 21.5, rh: 40, soc: 88, pmSlope: 0.3, level: 0, cause: 0, fw: "0.1.0" };
const tags = { loc: "43.66,-79.38", nodeName: "TMU test node" };
const at = "2026-10-28T15:00:00.000Z";

describe("nodeObservation", () => {
  it("places a reading using the twin tags IoT Hub stamped on it", () => {
    const o = nodeObservation("sylvia-sim-01", msg, tags, at)!;
    expect(o.kind).toBe("node");
    expect(o.id).toBe("node-sylvia-sim-01");
    expect(o.location.coordinates).toEqual([-79.38, 43.66]);
    expect(o.value).toBe(18.4);
    expect(o.label).toBe("TMU test node");
    expect(o.props).toMatchObject({ simulated: true, co: 1.25, co2: 512, cause: "None" });
    expect(o.ttl).toBe(6 * 3600);
  });

  it("drops a message from a node with no location tags instead of putting it at 0,0", () => {
    const unset = { loc: "$twin.tags.loc", nodeName: "$twin.tags.name" };
    expect(nodeObservation("sylvia-node-0002", msg, unset, at)).toBeUndefined();
  });

  it("ignores payloads it doesn't understand", () => {
    expect(nodeObservation("x", { v: 2 }, tags, at)).toBeUndefined();
    expect(nodeObservation("x", "not json", tags, at)).toBeUndefined();
  });

  it("treats a node as real unless its id says it's simulated, and keeps missing PM2.5 empty", () => {
    const o = nodeObservation("sylvia-node-0001", { ...msg, pm25: null }, { loc: "50.67,-120.33" }, at)!;
    expect(o.props?.simulated).toBe(false);
    expect(o.value).toBeUndefined();
    expect(o.label).toBe("sylvia-node-0001");
  });
});
