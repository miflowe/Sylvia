import { app, type InvocationContext } from "@azure/functions";
import { nodeObservation, type NodeEnrichment, type Observation } from "@sylvia/core";
import { upsertObservations } from "../lib/store";

// Sylvia Node telemetry from IoT Hub's built-in Event Hub-compatible endpoint. Each message carries the device id
// (system property) and the twin-tag enrichments (lat, lon, nodeName, simulated) as application properties.
app.eventHub("nodeTelemetry", {
  connection: "IOTHUB_EVENTS_CONNECTION",
  eventHubName: "%IOTHUB_EVENTS_NAME%",
  cardinality: "many",
  handler: async (messages: unknown[], context: InvocationContext) => {
    const props = (context.triggerMetadata?.propertiesArray ?? []) as NodeEnrichment[];
    const system = (context.triggerMetadata?.systemPropertiesArray ?? []) as Record<string, unknown>[];
    const enqueued = (context.triggerMetadata?.enqueuedTimeUtcArray ?? []) as string[];
    // Newest reading per node wins, since each node has one map document.
    const latest = new Map<string, Observation>();
    let skipped = 0;
    messages.forEach((body, i) => {
      const deviceId = String(system[i]?.["iothub-connection-device-id"] ?? "");
      const parsed =
        typeof body === "string" ? safeJson(body) : body instanceof Uint8Array ? safeJson(Buffer.from(body).toString("utf8")) : body;
      const at = enqueued[i] ? new Date(enqueued[i]).toISOString() : new Date().toISOString();
      const o = deviceId ? nodeObservation(deviceId, parsed, props[i] ?? {}, at) : undefined;
      if (o) latest.set(o.id, o);
      else skipped++;
    });
    const failed = latest.size ? await upsertObservations([...latest.values()]) : 0;
    context.log(`nodes: ${messages.length} messages, ${latest.size} stored, ${skipped} skipped, ${failed} failed`);
  },
});

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
