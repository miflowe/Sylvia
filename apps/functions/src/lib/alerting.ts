// Official notice ingestion and per-home alert evaluation.
import { randomUUID } from "node:crypto";
import { BulkOperationType, CosmosClient, type JSONObject, type OperationInput } from "@azure/cosmos";
import {
  distanceKm,
  evaluateAlerts,
  pointInArea,
  type Alert,
  type LatLon,
  type Observation,
  type OfficialNoticeDoc,
  type OfficialNotice,
  type ResidentReport,
  REPORTS_NOTE,
} from "@sylvia/core";
import { parseBcOrders, parseNaadAtom } from "./officials";
import { pushAlert, type StoredSubscription } from "./push";

let client: CosmosClient | undefined;
const db = () => (client ??= new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT!, key: process.env.COSMOS_KEY! })).database("sylvia");
const UA = { "user-agent": "Sylvia/0.1 (Imagine Cup student project; github.com/miflowe/Sylvia)" };

export interface PushSubscriptionDoc {
  id: string;
  deviceOrUserId: string;
  subscription: StoredSubscription;
  home: { name: string; lat: number; lon: number; regionCode?: string };
  location: { type: "Point"; coordinates: [number, number] };
  sensitive: boolean;
  updatedAt: string;
}

export interface AlertDoc extends Alert {
  id: string;
  deviceOrUserId: string;
  createdAt: string;
  delivery: "sent" | "failed" | "gone" | "not-pushed";
}

// ---------- Official notices ----------

const BC_ORDERS =
  "https://services6.arcgis.com/ubm4tcTYICKBpist/arcgis/rest/services/Evacuation_Orders_and_Alerts/FeatureServer/0/query" +
  "?where=ORDER_ALERT_STATUS%20IN%20(%27Order%27%2C%27Alert%27)&outFields=*&outSR=4326&f=geojson";
const NAAD = "https://rss.naad-adna.pelmorex.com/";

export async function ingestOfficial(): Promise<{ bc: number; naad: number; failed: number }> {
  const [bcRes, naadRes] = await Promise.all([fetch(BC_ORDERS, { headers: UA }), fetch(NAAD, { headers: UA })]);
  const bc = bcRes.ok ? parseBcOrders(await bcRes.json()) : [];
  const naad = naadRes.ok ? parseNaadAtom(await naadRes.text()) : [];
  const docs = [...bc, ...naad];
  let failed = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const ops: OperationInput[] = docs.slice(i, i + 100).map((d) => ({
      operationType: BulkOperationType.Upsert,
      partitionKey: d.regionCode,
      resourceBody: d as unknown as JSONObject,
    }));
    const res = await db().container("officialAlerts").items.bulk(ops, { continueOnError: true });
    failed += res.filter((r) => r.statusCode >= 300).length;
  }
  return { bc: bc.length, naad: naad.length, failed };
}

// ---------- Rule inputs for one home ----------

async function near(kind: Observation["kind"], home: LatLon, km: number, since?: string): Promise<Observation[]> {
  const { resources } = await db()
    .container("observations")
    .items.query<Observation>({
      query: `SELECT * FROM c WHERE c.kind = @k AND ST_DISTANCE(c.location, @p) <= @m${since ? " AND c.observedAt >= @since" : ""}`,
      parameters: [
        { name: "@k", value: kind },
        { name: "@p", value: { type: "Point", coordinates: [home.lon, home.lat] } },
        { name: "@m", value: km * 1000 },
        ...(since ? [{ name: "@since", value: since }] : []),
      ],
    })
    .fetchAll();
  return resources;
}

async function officialsFor(home: LatLon, regionCode?: string): Promise<OfficialNotice[]> {
  if (!regionCode) return [];
  const { resources } = await db()
    .container("officialAlerts")
    .items.query<OfficialNoticeDoc>(
      {
        query: "SELECT * FROM c WHERE c.bbox[0] <= @lon AND c.bbox[2] >= @lon AND c.bbox[1] <= @lat AND c.bbox[3] >= @lat",
        parameters: [
          { name: "@lon", value: home.lon },
          { name: "@lat", value: home.lat },
        ],
      },
      { partitionKey: regionCode },
    )
    .fetchAll();
  const now = new Date().toISOString();
  return resources
    .filter((d) => !d.expiresAt || d.expiresAt > now)
    .map((d) => ({ id: d.id, kind: d.kind, agency: d.agency, areaName: d.areaName, issuedAt: d.issuedAt, url: d.url, source: d.source, coversHome: pointInArea(home, d.area) }));
}

/** Resident reports near home in the last hour (they only ever add an unverified Level 1 note). */
async function reportsNear(home: LatLon, now: Date): Promise<ResidentReport[]> {
  const { resources } = await db()
    .container("reports")
    .items.query<{ id: string; kind: ResidentReport["kind"]; location: { coordinates: [number, number] }; reporter: string; createdAt: string }>({
      query: "SELECT c.id, c.kind, c.location, c.reporter, c.createdAt FROM c WHERE ST_DISTANCE(c.location, @p) <= @m AND c.createdAt >= @since",
      parameters: [
        { name: "@p", value: { type: "Point", coordinates: [home.lon, home.lat] } },
        { name: "@m", value: REPORTS_NOTE.km * 1000 },
        { name: "@since", value: new Date(now.getTime() - REPORTS_NOTE.minutes * 60e3).toISOString() },
      ],
    })
    .fetchAll()
    .catch(() => ({ resources: [] }));
  return resources.map((r) => ({ id: r.id, kind: r.kind, reporter: r.reporter, createdAt: r.createdAt, location: { lat: r.location.coordinates[1], lon: r.location.coordinates[0] } }));
}

const obsPoint = (o: Observation) => ({ lat: o.location.coordinates[1], lon: o.location.coordinates[0] });

export async function alertsForHome(sub: Pick<PushSubscriptionDoc, "home" | "sensitive">, now = new Date()): Promise<Alert[]> {
  const home = { lat: sub.home.lat, lon: sub.home.lon };
  const since12h = new Date(now.getTime() - 12 * 3600e3).toISOString();
  const since2h = new Date(now.getTime() - 2 * 3600e3).toISOString();
  const [hotspots, aqhis, pms, officials, reports] = await Promise.all([
    near("hotspot", home, 25, since12h),
    near("aqhi", home, 120),
    near("pm25", home, 10, since2h),
    officialsFor(home, sub.home.regionCode),
    reportsNear(home, now),
  ]);
  const station = aqhis.sort((a, b) => distanceKm(home, obsPoint(a)) - distanceKm(home, obsPoint(b)))[0];
  const pmValues = pms.map((p) => p.value!).sort((a, b) => a - b);
  return evaluateAlerts({
    now: now.toISOString(),
    home,
    sensitive: sub.sensitive,
    hotspots: hotspots.map((h) => ({ location: obsPoint(h), observedAt: h.observedAt })),
    aqhi: station?.value !== undefined ? { value: station.value, station: station.label ?? "nearest station", observedAt: station.observedAt } : undefined,
    pm25: pmValues.length ? { median: pmValues[Math.floor(pmValues.length / 2)]!, sensors: pmValues.length, observedAt: pms[0]!.observedAt } : undefined,
    officials,
    reports,
  });
}

// ---------- Deliver ----------

/** Stores and pushes alerts not already sent to this device in the last 12 hours (same key). */
export async function deliver(sub: PushSubscriptionDoc, alerts: Alert[], dedupeHours = 12): Promise<AlertDoc[]> {
  const container = db().container("alerts");
  const since = new Date(Date.now() - dedupeHours * 3600e3).toISOString();
  const sent: AlertDoc[] = [];
  for (const alert of alerts) {
    const { resources: dup } = await container.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.deviceOrUserId = @d AND c.key = @k AND c.createdAt >= @since",
        parameters: [
          { name: "@d", value: sub.deviceOrUserId },
          { name: "@k", value: alert.key ?? "" },
          { name: "@since", value: since },
        ],
      }, { partitionKey: sub.deviceOrUserId })
      .fetchAll();
    if ((dup[0] as number) > 0) continue;
    const doc: AlertDoc = { ...alert, id: randomUUID(), deviceOrUserId: sub.deviceOrUserId, createdAt: new Date().toISOString(), delivery: "not-pushed" };
    doc.delivery = await pushAlert(sub.subscription, doc);
    await container.items.create(doc);
    sent.push(doc);
    if (doc.delivery === "gone") {
      await db().container("pushSubscriptions").item(sub.id, sub.deviceOrUserId).delete().catch(() => {});
      break;
    }
  }
  return sent;
}

export async function evaluateAll(): Promise<{ homes: number; alerts: number }> {
  const { resources: subs } = await db().container("pushSubscriptions").items.query<PushSubscriptionDoc>("SELECT * FROM c").fetchAll();
  let count = 0;
  for (const sub of subs) {
    try {
      count += (await deliver(sub, await alertsForHome(sub))).length;
    } catch (e) {
      console.error(`evaluate ${sub.id} failed`, e);
    }
  }
  return { homes: subs.length, alerts: count };
}
