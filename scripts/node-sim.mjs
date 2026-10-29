// Sylvia Node cloud test: plays a Node through the real cloud path, then checks the reading reached the map.
//   node scripts/node-sim.mjs <iot hub name> <resource group> <web url> [readings]
// Registers device "sylvia-sim-01" (symmetric key; real Nodes use X.509 over MQTT, same telemetry endpoint), tags it
// as a simulated test node at TMU (rounded to ~1 km), sends readings in the firmware's payload_json() format over
// HTTPS, then polls the web app's /api/map until the reading shows up. Keys are fetched with `az` and never printed.
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";

const [hubName, group, web, count = "3"] = process.argv.slice(2);
if (!hubName || !group || !web) {
  console.log("usage: node scripts/node-sim.mjs <iot hub name> <resource group> <web url> [readings]");
  process.exit(1);
}
const host = `${hubName}.azure-devices.net`;
const DEVICE = "sylvia-sim-01";
const TAGS = { lat: "43.66", lon: "-79.38", name: "TMU test node", simulated: "true" };

function sas(resource, key, policy) {
  const se = Math.round(Date.now() / 1000) + 3600;
  const sr = encodeURIComponent(resource);
  const sig = encodeURIComponent(createHmac("sha256", Buffer.from(key, "base64")).update(`${sr}\n${se}`).digest("base64"));
  return `SharedAccessSignature sr=${sr}&sig=${sig}&se=${se}${policy ? `&skn=${policy}` : ""}`;
}

const az = (args) => execFileSync("az", args, { encoding: "utf8", shell: process.platform === "win32" });
const keys = JSON.parse(
  az(["rest", "--method", "post", "--url", `/subscriptions/{subscriptionId}/resourceGroups/${group}/providers/Microsoft.Devices/IotHubs/${hubName}/listkeys?api-version=2023-06-30`]),
);
const owner = keys.value.find((k) => k.keyName === "iothubowner");
const service = { authorization: sas(host, owner.primaryKey, "iothubowner"), "content-type": "application/json" };

async function call(method, path, body, headers = service) {
  const res = await fetch(`https://${host}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  return res.status === 404 ? undefined : text ? JSON.parse(text) : {};
}

// 1. Device identity (reuse it if it already exists).
let device = await call("GET", `/devices/${DEVICE}?api-version=2021-04-12`);
if (!device) {
  device = await call("PUT", `/devices/${DEVICE}?api-version=2021-04-12`, {
    deviceId: DEVICE,
    authentication: { type: "sas", symmetricKey: { primaryKey: randomBytes(32).toString("base64"), secondaryKey: randomBytes(32).toString("base64") } },
  });
  console.log(`registered ${DEVICE}`);
} else console.log(`${DEVICE} already registered`);

// 2. Twin tags: location and labels that IoT Hub stamps onto every message.
await call("PATCH", `/twins/${DEVICE}?api-version=2021-04-12`, { tags: TAGS }, { ...service, "if-match": "*" });
console.log(`tagged ${DEVICE}: ${TAGS.name}, simulated`);

// 3. Telemetry, exactly as the firmware's payload_json() writes it.
const deviceAuth = sas(`${host}/devices/${DEVICE}`, device.authentication.symmetricKey.primaryKey);
const sent = [];
for (let seq = 1; seq <= Number(count); seq++) {
  const t = {
    v: 1, seq, up: 600 * seq, pm1: 4.1, pm25: +(7.5 + seq * 0.6).toFixed(1), pm4: 8.9, pm10: 9.6, co2: 455 + seq * 4, voc: 102, nox: 1,
    co: +(0.3 + seq * 0.05).toFixed(2), t: 9.5, rh: 71.0, p: 1006.4, gas: 182.0, soc: 93.0, vbat: 3.281, pmSlope: 0.12,
    chg: true, sen66: true, level: 0, cause: 0, fw: "0.1.0-sim",
  };
  const res = await fetch(`https://${host}/devices/${DEVICE}/messages/events?api-version=2020-09-30`, {
    method: "POST",
    headers: { authorization: deviceAuth, "content-type": "application/json", "iothub-contenttype": "application/json", "iothub-contentencoding": "utf-8" },
    body: JSON.stringify(t),
  });
  if (!res.ok) throw new Error(`send ${seq}: ${res.status} ${await res.text()}`);
  sent.push(t);
  console.log(`sent reading ${seq}: PM2.5 ${t.pm25}, CO ${t.co} ppm`);
  await new Promise((r) => setTimeout(r, 3000));
}

// 4. Did it reach the map?
const last = sent.at(-1);
const started = Date.now();
for (;;) {
  const res = await fetch(`${web}/api/map?bbox=-79.6,43.5,-79.2,43.8&zoom=11`);
  const body = res.ok ? await res.json() : {};
  const f = body.nodes?.features?.find((x) => x.properties?.deviceId === DEVICE);
  if (f && f.properties.value === last.pm25) {
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`on the map after ~${seconds}s: ${f.properties.name}, PM2.5 ${f.properties.value}, CO ${f.properties.co} ppm, simulated=${f.properties.simulated}`);
    console.log(JSON.stringify({ ok: true, device: DEVICE, readings: sent.length, secondsToMap: seconds, mapFeature: f.properties }));
    break;
  }
  if (Date.now() - started > 5 * 60 * 1000) {
    console.log(JSON.stringify({ ok: false, device: DEVICE, readings: sent.length, note: "no matching node on the map after 5 minutes" }));
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 10000));
}
