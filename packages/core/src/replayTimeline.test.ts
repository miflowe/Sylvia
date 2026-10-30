import { describe, expect, it } from "vitest";
import { buildTimeline, estimateOutlines, replayAt, type ReplayFrameInput } from "./replayTimeline";
import type { OfficialNotice } from "./rules";

const home = { lat: 50.124, lon: -119.509 };
const notice = (kind: "alert" | "order", issuedAt: string): OfficialNotice => ({
  id: "bc:1",
  kind,
  agency: "Regional District of Central Okanagan",
  areaName: "Quilpituk Creek",
  issuedAt,
  coversHome: true,
  source: { name: "BC evacuation orders", url: "https://example.ca" },
});
const heat = (lat: number, lon: number, observedAt: string) => ({ location: { lat, lon }, observedAt });

const frames: ReplayFrameInput[] = [
  { at: "2026-07-31T20:00:00Z", label: "Jul 31, 1 p.m. PDT · A normal summer day", hotspots: [], officials: [] },
  {
    at: "2026-08-01T09:20:00Z",
    label: "Aug 1, 2:20 a.m. PDT · First satellite heat detections",
    hotspots: [heat(50.3, -119.4, "2026-08-01T09:09:00Z"), heat(50.301, -119.402, "2026-08-01T09:09:00Z"), heat(50.302, -119.398, "2026-08-01T09:09:00Z")],
    officials: [],
  },
  { at: "2026-08-01T12:00:00Z", label: "Aug 1 · Official evacuation alert", hotspots: [heat(50.3, -119.4, "2026-08-01T09:09:00Z")], officials: [notice("alert", "2026-08-01T12:00:00Z")] },
  { at: "2026-08-02T12:00:00Z", label: "Aug 2 · Official evacuation order", hotspots: [heat(50.13, -119.5, "2026-08-02T08:50:00Z")], officials: [notice("order", "2026-08-02T12:00:00Z")] },
];

describe("replay timeline", () => {
  const tl = buildTimeline(frames);

  it("starts a few hours before the first heat and removes repeated detections", () => {
    expect(new Date(tl.start).toISOString()).toBe("2026-08-01T06:00:00.000Z");
    expect(tl.detections).toHaveLength(4);
  });

  it("shows nothing before the fire and no alerts", () => {
    const s = replayAt(tl, home, Date.parse("2026-08-01T08:00:00Z"), false);
    expect(s.hotspots).toHaveLength(0);
    expect(s.alerts).toHaveLength(0);
    expect(s.outlines).toHaveLength(0);
  });

  it("raises an unverified heat advisory once satellites see heat, and estimates an outline", () => {
    const s = replayAt(tl, home, Date.parse("2026-08-01T10:00:00Z"), false);
    expect(s.hotspots).toHaveLength(3);
    expect(s.alerts.map((a) => a.level)).toEqual([1]);
    expect(s.alerts[0]!.official).toBeUndefined();
    expect(s.alerts[0]!.replay).toBe(true);
    expect(s.outlines).toHaveLength(1);
    expect(s.caption).toBe("First satellite heat detections");
  });

  it("relays the official alert, then the order replaces it", () => {
    const alert = replayAt(tl, home, Date.parse("2026-08-01T13:00:00Z"), false).alerts.find((a) => a.official);
    expect(alert?.level).toBe(2);
    const order = replayAt(tl, home, Date.parse("2026-08-02T12:00:00Z"), false).alerts.filter((a) => a.official);
    expect(order.map((a) => a.level)).toEqual([3]);
    expect(order[0]!.issuingAgency).toBe("Regional District of Central Okanagan");
  });

  it("drops heat older than 24 hours", () => {
    const s = replayAt(tl, home, Date.parse("2026-08-02T12:00:00Z"), false);
    expect(s.hotspots.map((h) => h.observedAt)).toEqual(["2026-08-02T08:50:00Z"]);
  });
});

describe("estimateOutlines", () => {
  it("needs three nearby detections and returns a closed ring", () => {
    expect(estimateOutlines([{ lat: 50, lon: -120 }, { lat: 50.001, lon: -120 }])).toHaveLength(0);
    const [ring] = estimateOutlines([{ lat: 50, lon: -120 }, { lat: 50.01, lon: -120 }, { lat: 50, lon: -120.01 }]);
    expect(ring![0]).toEqual(ring![ring!.length - 1]);
  });

  it("keeps far-apart fires as separate outlines", () => {
    const a = [{ lat: 50, lon: -120 }, { lat: 50.01, lon: -120 }, { lat: 50, lon: -120.01 }];
    const b = a.map((p) => ({ lat: p.lat + 1, lon: p.lon }));
    expect(estimateOutlines([...a, ...b])).toHaveLength(2);
  });
});
