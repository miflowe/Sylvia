import { describe, expect, it } from "vitest";
import { evaluateAlerts, type RuleInput } from "./rules";
import { assertAlertAuthority, AlertAuthorityError } from "./alerts";

const home = { lat: 50.12, lon: -119.5 };
const now = "2026-08-02T12:00:00Z";
const base: RuleInput = { now, home, sensitive: false, hotspots: [], officials: [] };
const at = (km: number, hoursAgo: number) => ({
  location: { lat: home.lat + km / 111, lon: home.lon },
  observedAt: new Date(Date.parse(now) - hoursAgo * 3600e3).toISOString(),
});
const notice = (kind: "order" | "alert", coversHome = true) => ({
  id: "x1",
  kind,
  agency: "Regional District of Central Okanagan",
  areaName: "Quilpituk Creek",
  issuedAt: now,
  coversHome,
  source: { name: "BC Emergency Management", url: "https://www.emergencyinfobc.gov.bc.ca/" },
});

describe("alert rules", () => {
  it("is quiet when nothing is nearby", () => {
    expect(evaluateAlerts(base)).toEqual([]);
  });

  it("gives an unverified advisory for one detection within 25 km", () => {
    const [a] = evaluateAlerts({ ...base, hotspots: [at(20, 3)] });
    expect(a).toMatchObject({ level: 1, title: "Heat detected nearby" });
    expect(a!.official).toBeUndefined();
    expect(a!.body).toMatch(/20 km N/);
    expect(a!.body).toMatch(/about 3 hours ago/);
    expect(evaluateAlerts({ ...base, hotspots: [at(20, 1)] })[0]!.body).toMatch(/about 1 hour ago/);
  });

  it("warns at Level 2 for two recent detections within 10 km, without telling people to evacuate", () => {
    const [a] = evaluateAlerts({ ...base, hotspots: [at(6, 2), at(7, 2)] });
    expect(a).toMatchObject({ level: 2, title: "Fire activity near you" });
    expect(a!.body).toMatch(/Be ready to leave if officials tell you to/);
    expect(a!.body).not.toMatch(/\bleave now\b|evacuate now/i);
  });

  it("ignores old detections", () => {
    expect(evaluateAlerts({ ...base, hotspots: [at(5, 13)] })).toEqual([]);
  });

  it("relays an official order covering the home at Level 3 with the agency", () => {
    const alerts = evaluateAlerts({ ...base, officials: [notice("order")], hotspots: [at(6, 2), at(7, 2)] });
    expect(alerts[0]).toMatchObject({ level: 3, official: true, issuingAgency: "Regional District of Central Okanagan" });
    // The official order replaces Sylvia's own hotspot warning.
    expect(alerts.some((a) => a.title === "Fire activity near you")).toBe(false);
  });

  it("relays an official evacuation alert at Level 2, labelled official", () => {
    const [a] = evaluateAlerts({ ...base, officials: [notice("alert")] });
    expect(a).toMatchObject({ level: 2, official: true, title: "Evacuation alert" });
  });

  it("ignores official notices that don't cover the home", () => {
    expect(evaluateAlerts({ ...base, officials: [notice("order", false)] })).toEqual([]);
  });

  it("lowers smoke thresholds for people sensitive to smoke", () => {
    const aqhi = { value: 5, station: "Kelowna", observedAt: now };
    expect(evaluateAlerts({ ...base, aqhi })).toEqual([]);
    expect(evaluateAlerts({ ...base, aqhi, sensitive: true })[0]).toMatchObject({ level: 1, title: "Smoky air" });
  });

  it("flags replays", () => {
    expect(evaluateAlerts({ ...base, hotspots: [at(20, 3)], replay: true })[0]!.replay).toBe(true);
  });

  it("rejects Level 3 without an official agency", () => {
    expect(() => assertAlertAuthority({ level: 3, title: "x", body: "", sources: [{ name: "s", observedAt: now }] })).toThrow(AlertAuthorityError);
  });
});
