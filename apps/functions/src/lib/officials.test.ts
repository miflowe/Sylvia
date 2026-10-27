import { describe, expect, it } from "vitest";
import { pointInArea } from "@sylvia/core";
import { parseBcOrders, parseNaadAtom } from "./officials";

describe("BC evacuation orders", () => {
  const ring = [[-119.55, 50.1], [-119.45, 50.1], [-119.45, 50.15], [-119.55, 50.15], [-119.55, 50.1]];
  const feature = (status: string, id = 1) => ({
    geometry: { type: "Polygon" as const, coordinates: [ring] },
    properties: { EMRG_OAA_SYSID: id, EVENT_NAME: "Quilpituk Creek Wildfire", EVENT_TYPE: "Fire", ORDER_ALERT_NAME: "Quilpituk Creek", ORDER_ALERT_STATUS: status, ISSUING_AGENCY: "Regional District of Central Okanagan", DATE_MODIFIED: 1785585600000 },
  });

  it("keeps orders and alerts, skips all-clears", () => {
    const docs = parseBcOrders({ features: [feature("Order", 1), feature("Alert", 2), feature("All Clear", 3)] });
    expect(docs.map((d) => d.kind)).toEqual(["order", "alert"]);
    expect(docs[0]).toMatchObject({ regionCode: "CA-BC", agency: "Regional District of Central Okanagan", areaName: "Quilpituk Creek" });
    expect(pointInArea({ lat: 50.12, lon: -119.5 }, docs[0]!.area)).toBe(true);
  });
});

describe("Alert Ready (NAAD)", () => {
  const entry = (status: string, event: string, title: string, polygon = "50.10 -119.55 50.10 -119.45 50.15 -119.45 50.15 -119.55 50.10 -119.55") => `
<entry><id>tag:rss.naad-adna.pelmorex.com,2026-08-02:feed.atom/abc:123</id><title>${title}</title><updated>2026-08-02T18:00:00-00:00</updated>
<author><name>BC Wildfire Service</name></author><georss:polygon>${polygon}</georss:polygon>
<summary type="html">Description: ${title}&lt;br&gt;Expires: 2026-08-03T18:00:00-00:00&lt;br&gt;Area: Lake Country</summary>
<category term="status=${status}" /><category term="msgType=Alert" /><category term="scope=Public" /><category term="language=en-CA" /><category term="event=${event}" /></entry>`;

  it("keeps actual wildfire alerts and reads orders from their text", () => {
    const docs = parseNaadAtom(`<feed>${entry("Actual", "wildfire", "Evacuation order for Lake Country")}${entry("Actual", "wildfire", "Wildfire smoke warning")}</feed>`);
    expect(docs.map((d) => d.kind)).toEqual(["order", "alert"]);
    expect(docs[0]).toMatchObject({ agency: "BC Wildfire Service", areaName: "Lake Country", regionCode: "CA-BC", expiresAt: "2026-08-03T18:00:00.000Z" });
    expect(pointInArea({ lat: 50.12, lon: -119.5 }, docs[0]!.area)).toBe(true);
  });

  it("skips tests, other hazards and areas outside Ontario and BC", () => {
    const xml = `<feed>${entry("Test", "wildfire", "Evacuation order")}${entry("Actual", "tornado", "Tornado warning")}${entry("Actual", "wildfire", "Evacuation order", "66.9 -125.8 67.0 -125.8 67.0 -126.1 66.9 -126.1 66.9 -125.8")}</feed>`;
    expect(parseNaadAtom(xml)).toEqual([]);
  });
});
