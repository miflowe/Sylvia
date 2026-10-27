// `pnpm data:replay`: builds the Quilpituk Creek (2026) replay event from archived public data and uploads it to
// the `replayEvents` container. Inputs are committed in data/replay/quilpituk-creek-2026/ so anyone can rebuild it.
//
// Honesty rules: every frame uses only data observed by that time. BC publishes evacuation order and alert *dates*
// (stored at 12:00 UTC), not times, so those frames say "date only".
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { CosmosClient } from "@azure/cosmos";
import { distanceKm, OFFICIAL_SOURCES, pointInArea, type AreaGeometry, type OfficialNotice } from "@sylvia/core";

const dir = fileURLToPath(new URL("../replay/quilpituk-creek-2026/", import.meta.url));
const AGENCY = "Regional District of Central Okanagan";

// --- Archived satellite detections (NASA FIRMS VIIRS NRT, 3 satellites) ---
const [header, ...rows] = readFileSync(dir + "firms.csv", "utf8").trim().split(/\r?\n/);
const cols = header!.split(",");
const col = (r: string[], n: string) => r[cols.indexOf(n)]!;
const detections = rows
  .map((l) => l.split(","))
  .map((r) => {
    const t = col(r, "acq_time").padStart(4, "0");
    return { lat: Number(col(r, "latitude")), lon: Number(col(r, "longitude")), observedAt: `${col(r, "acq_date")}T${t.slice(0, 2)}:${t.slice(2)}:00Z` };
  })
  .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

// --- Official order and alert areas (BC historical orders, event K51402) ---
interface OrderFeature {
  geometry: AreaGeometry;
  properties: { ORDER_ALERT_NAME: string; START_ALERT_DATE: number | null; START_ORDER_DATE: number | null; MULTI_SOURCED_HOMES: number };
}
const orders = (JSON.parse(readFileSync(dir + "orders.geojson", "utf8")) as { features: OrderFeature[] }).features;

// Home: inside the area with the most homes (alerted Aug 1, ordered Aug 2).
const main = orders.slice().sort((a, b) => b.properties.MULTI_SOURCED_HOMES - a.properties.MULTI_SOURCED_HOMES)[0]!;
const ring = (main.geometry.type === "Polygon" ? main.geometry.coordinates[0] : main.geometry.coordinates[0]![0])!;
const centre = { lon: ring.reduce((s, p) => s + p[0]!, 0) / ring.length, lat: ring.reduce((s, p) => s + p[1]!, 0) / ring.length };
if (!pointInArea(centre, main.geometry)) throw new Error("Home point is not inside the order area; pick another point.");
const home = { name: "Westside Road, near Kelowna (replay home)", lat: Math.round(centre.lat * 1000) / 1000, lon: Math.round(centre.lon * 1000) / 1000 };

const iso = (ms: number) => new Date(ms).toISOString();
function officialsAt(at: string): OfficialNotice[] {
  const out: OfficialNotice[] = [];
  orders.forEach((f, i) => {
    const p = f.properties;
    const ordered = p.START_ORDER_DATE !== null && iso(p.START_ORDER_DATE) <= at;
    const alerted = p.START_ALERT_DATE !== null && iso(p.START_ALERT_DATE) <= at;
    if (!ordered && !alerted) return;
    out.push({
      id: `bc-hist:K51402:${i}`,
      kind: ordered ? "order" : "alert",
      agency: AGENCY,
      areaName: p.ORDER_ALERT_NAME,
      issuedAt: iso((ordered ? p.START_ORDER_DATE : p.START_ALERT_DATE)!),
      url: OFFICIAL_SOURCES.bc.url,
      coversHome: pointInArea(home, f.geometry),
      source: { name: "BC historical evacuation orders and alerts", url: "https://catalogue.data.gov.bc.ca/" },
    });
  });
  return out.filter((o) => o.coversHome);
}

// --- Frames: quiet day before, each satellite pass on Aug 1, the official alert and order dates ---
const frameTimes: { at: string; label: string; dateOnly?: boolean }[] = [
  { at: "2026-07-31T20:00:00Z", label: "Jul 31, 1 p.m. PDT · A normal summer day" },
  { at: "2026-08-01T09:20:00Z", label: "Aug 1, 2:20 a.m. PDT · First satellite heat detections" },
  { at: "2026-08-01T11:30:00Z", label: "Aug 1, 4:30 a.m. PDT · More passes overnight" },
  { at: "2026-08-01T12:00:00Z", label: "Aug 1 · Official evacuation alert (BC publishes the date only)", dateOnly: true },
  { at: "2026-08-01T21:30:00Z", label: "Aug 1, 2:30 p.m. PDT · Afternoon passes" },
  { at: "2026-08-02T12:00:00Z", label: "Aug 2 · Official evacuation order (BC publishes the date only)", dateOnly: true },
];
const frames = frameTimes.map((f) => ({
  ...f,
  hotspots: detections
    .filter((d) => d.observedAt <= f.at && Date.parse(f.at) - Date.parse(d.observedAt) <= 12 * 3600e3)
    .filter((d) => distanceKm(home, d) <= 25)
    .map((d) => ({ location: { lat: d.lat, lon: d.lon }, observedAt: d.observedAt })),
  officials: officialsAt(f.at),
}));

const event = {
  id: "quilpituk-creek-2026",
  eventId: "quilpituk-creek-2026",
  name: "Quilpituk Creek wildfire",
  dateLabel: "Aug 2026",
  regionCode: "CA-BC",
  summary: "A wildfire north of Kelowna that led to evacuation alerts and orders for thousands of homes in Central Okanagan.",
  home,
  sources: [
    { name: "NASA FIRMS (VIIRS NOAA-20, NOAA-21, Suomi NPP, near real-time archive)", url: "https://firms.modaps.eosdis.nasa.gov/" },
    { name: "BC historical evacuation orders and alerts (event K51402)", url: "https://catalogue.data.gov.bc.ca/" },
  ],
  frames,
};
writeFileSync(dir + "event.json", JSON.stringify(event, null, 1));
console.log(`home ${home.lat},${home.lon}; frames: ${frames.map((f) => `${f.hotspots.length}h/${f.officials.map((o) => o.kind).join("+") || "-"}`).join(" | ")}`);

if (process.argv.includes("--upload")) {
  const sh = (c: string) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  const endpoint = sh("azd env get-value COSMOS_ENDPOINT");
  const name = new URL(endpoint).hostname.split(".")[0];
  const key = sh(`az cosmosdb keys list -g ${sh("azd env get-value AZURE_RESOURCE_GROUP")} -n ${name} --query primaryMasterKey -o tsv`);
  await new CosmosClient({ endpoint, key }).database("sylvia").container("replayEvents").items.upsert(event);
  console.log("uploaded to replayEvents");
}
