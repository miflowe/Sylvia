import { describe, expect, it } from "vitest";
import { groupReports, reportsNote, roundToKm, type ResidentReport } from "./reports";
import { evaluateAlerts } from "./rules";

const home = { lat: 50.67, lon: -120.33 };
const now = "2026-10-30T18:00:00Z";
const r = (reporter: string, kind: ResidentReport["kind"], minutesAgo: number, at = { lat: 50.675, lon: -120.335 }): ResidentReport => ({
  id: `${reporter}-${minutesAgo}`,
  kind,
  location: at,
  reporter,
  createdAt: new Date(Date.parse(now) - minutesAgo * 60000).toISOString(),
});

describe("roundToKm", () => {
  it("rounds to about 1 km", () => {
    expect(roundToKm({ lat: 50.67891, lon: -120.33449 })).toEqual({ lat: 50.68, lon: -120.33 });
  });
});

describe("groupReports", () => {
  it("counts different people once per place and kind, newest first", () => {
    const g = groupReports([{ ...r("a", "smoke", 30), note: "Thick smoke to the north" }, r("a", "smoke", 10), r("b", "smoke", 5), r("c", "flames", 2)]);
    const smoke = g.find((x) => x.kind === "smoke")!;
    expect(smoke.people).toBe(2);
    expect(smoke.notes).toEqual(["Thick smoke to the north"]);
    expect(g.find((x) => x.kind === "flames")!.people).toBe(1);
  });
});

describe("reportsNote", () => {
  it("needs three different people nearby within the hour", () => {
    expect(reportsNote(home, [r("a", "smoke", 5), r("a", "smoke", 4), r("b", "smoke", 3)], now)).toBeUndefined();
    const note = reportsNote(home, [r("a", "smoke", 50), r("b", "smoke", 20), r("c", "flames", 5)], now)!;
    expect(note.level).toBe(1);
    expect(note.official).toBeUndefined();
    expect(note.title).toBe("Residents report fire nearby");
    expect(note.body).toMatch(/not confirmed.*call 911/);
  });

  it("ignores old, far-away and ash-only reports", () => {
    const far = { lat: 50.8, lon: -120.33 };
    expect(reportsNote(home, [r("a", "smoke", 90), r("b", "smoke", 5, far), r("c", "ash", 5), r("d", "smoke", 5)], now)).toBeUndefined();
  });
});

describe("reports in evaluateAlerts", () => {
  const three = [r("a", "smoke", 30), r("b", "smoke", 20), r("c", "smoke", 10)];
  it("adds the note when nothing else covers it", () => {
    const alerts = evaluateAlerts({ now, home, sensitive: false, hotspots: [], officials: [], reports: three });
    expect(alerts.map((a) => a.title)).toEqual(["Residents report smoke nearby"]);
  });

  it("stays quiet when satellites already raised an alert", () => {
    const hotspots = [{ location: { lat: 50.7, lon: -120.3 }, observedAt: "2026-10-30T17:00:00Z" }];
    const alerts = evaluateAlerts({ now, home, sensitive: false, hotspots, officials: [], reports: three });
    expect(alerts.some((a) => a.title.startsWith("Residents"))).toBe(false);
  });
});
