import { cellIdFor, isValidLatLon } from "./geo";
import type { Observation } from "./observations";

/**
 * Sylvia Node telemetry, as the firmware's payload_json() writes it (hardware/firmware/components/payload).
 * Location never comes from the device: IoT Hub stamps each message with the device twin's tags
 * (lat, lon rounded to about 1 km, name, simulated) through message enrichments.
 */
export interface NodeTelemetry {
  v: number;
  seq: number;
  up?: number;
  pm1?: number | null;
  pm25?: number | null;
  pm4?: number | null;
  pm10?: number | null;
  co2?: number | null;
  voc?: number | null;
  nox?: number | null;
  co?: number | null;
  t?: number | null;
  rh?: number | null;
  soc?: number | null;
  pmSlope?: number | null;
  level?: number;
  cause?: number;
  fw?: string;
}

export interface NodeEnrichment {
  lat?: string | number;
  lon?: string | number;
  nodeName?: string;
  simulated?: string | boolean;
}

export const NODE_SOURCE = { name: "Sylvia Node", url: "https://github.com/miflowe/Sylvia/tree/main/hardware" } as const;

/** Detection causes from the firmware (detect.h). */
export const NODE_CAUSES = ["None", "Smoke rising", "Smouldering (CO with smoke)", "Sensor fault"] as const;

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
// An unset twin tag arrives as the literal enrichment text, e.g. "$twin.tags.lat".
const tag = (x: unknown) => (typeof x === "string" && x.startsWith("$twin") ? undefined : x);

/**
 * One map reading per message. Returns undefined when the message can't be placed or read,
 * so a mis-provisioned node never lands at 0,0.
 */
export function nodeObservation(deviceId: string, body: unknown, props: NodeEnrichment, receivedAt: string): Observation | undefined {
  const t = body as Partial<NodeTelemetry>;
  if (!t || typeof t !== "object" || t.v !== 1) return undefined;
  const at = { lat: Number(tag(props.lat)), lon: Number(tag(props.lon)) };
  if (!isValidLatLon(at)) return undefined;
  const simulated = String(tag(props.simulated) ?? "false") === "true";
  const pm25 = num(t.pm25);
  const extra: Record<string, number | string | boolean> = { deviceId, simulated, level: t.level ?? 0, cause: NODE_CAUSES[t.cause ?? 0] ?? "None" };
  for (const k of ["co2", "co", "t", "rh", "soc", "pmSlope"] as const) {
    const v = num(t[k]);
    if (v !== undefined) extra[k] = v;
  }
  const name = tag(props.nodeName);
  return {
    // One document per node, overwritten by each new reading.
    id: `node-${deviceId}`,
    cellId: cellIdFor(at),
    kind: "node",
    source: NODE_SOURCE,
    location: { type: "Point", coordinates: [at.lon, at.lat] },
    observedAt: receivedAt,
    value: pm25,
    label: typeof name === "string" && name ? name : deviceId,
    props: extra,
    // A node that stops reporting disappears from the map after six hours.
    ttl: 6 * 3600,
  };
}
