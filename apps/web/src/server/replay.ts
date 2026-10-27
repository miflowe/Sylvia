import "server-only";
import { randomUUID } from "node:crypto";
import { evaluateAlerts, type Alert, type OfficialNotice } from "@sylvia/core";
import { container } from "./cosmos";
import { pushToDevice, type StoredSubscription } from "./push";

export interface ReplayEvent {
  id: string;
  name: string;
  dateLabel: string;
  regionCode: string;
  summary: string;
  home: { name: string; lat: number; lon: number };
  sources: { name: string; url: string }[];
  frames: { at: string; label: string; dateOnly?: boolean; hotspots: { location: { lat: number; lon: number }; observedAt: string }[]; officials: OfficialNotice[] }[];
}

const cache = new Map<string, ReplayEvent>();
export async function getEvent(id: string): Promise<ReplayEvent | undefined> {
  if (!cache.has(id)) {
    const { resource } = await container("replayEvents").item(id, id).read<ReplayEvent>();
    if (resource) cache.set(id, resource);
  }
  return cache.get(id);
}

export async function listEvents() {
  const { resources } = await container("replayEvents")
    .items.query<Pick<ReplayEvent, "id" | "name" | "dateLabel" | "summary" | "home" | "sources"> & { frames: { label: string }[] }>(
      "SELECT c.id, c.name, c.dateLabel, c.summary, c.home, c.sources, ARRAY(SELECT VALUE { label: f.label } FROM f IN c.frames) AS frames FROM c",
    )
    .fetchAll();
  return resources;
}

/**
 * Runs one replay frame for a device: the same rules as live alerts, on archived data, with every alert marked as
 * a replay. Alerts are stored in the device's history and pushed if alerts are on.
 */
export async function runFrame(event: ReplayEvent, frameIndex: number, device: string, runId: string, sensitive: boolean) {
  const frame = event.frames[frameIndex];
  if (!frame) return undefined;
  const alerts = evaluateAlerts({
    now: frame.at,
    home: event.home,
    sensitive,
    hotspots: frame.hotspots,
    officials: frame.officials,
    replay: true,
  }).map((a) => ({ ...a, key: `replay:${runId}:${a.key}` }));

  const store = container("alerts");
  const { resource: sub } = await container("pushSubscriptions").item(device, device).read<{ subscription: StoredSubscription }>();
  const fresh: (Alert & { id: string; createdAt: string })[] = [];
  for (const a of alerts) {
    const { resources } = await store.items
      .query({ query: "SELECT VALUE COUNT(1) FROM c WHERE c.deviceOrUserId = @d AND c.key = @k", parameters: [{ name: "@d", value: device }, { name: "@k", value: a.key }] }, { partitionKey: device })
      .fetchAll();
    if ((resources[0] as number) > 0) continue; // already shown earlier in this run
    const doc = { ...a, id: randomUUID(), deviceOrUserId: device, createdAt: new Date().toISOString(), replayFrameAt: frame.at, delivery: sub ? await pushToDevice(sub.subscription, a) : "not-pushed" };
    await store.items.create(doc);
    fresh.push(doc);
  }
  return { label: frame.label, dateOnly: !!frame.dateOnly, hotspotCount: frame.hotspots.length, alerts: fresh, pushed: !!sub };
}

/** Removes this device's replay alerts, so a demo can be run again cleanly. */
export async function clearReplays(device: string): Promise<number> {
  const store = container("alerts");
  const { resources } = await store.items
    .query<{ id: string }>({ query: "SELECT c.id FROM c WHERE c.deviceOrUserId = @d AND c.replay = true", parameters: [{ name: "@d", value: device }] }, { partitionKey: device })
    .fetchAll();
  for (const r of resources) await store.item(r.id, device).delete();
  return resources.length;
}
