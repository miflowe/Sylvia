/**
 * Replay on the map: turns an archived fire's frames into a continuous timeline, then answers "what did we know at
 * time t?": heat detected so far (the last 24 h of it), an outline estimated from that heat, and the alerts the
 * live rules would have raised. Pure, so the map can scrub back and forth without side effects.
 */
import type { Alert } from "./alerts";
import { distanceKm, type LatLon } from "./geo";
import { evaluateAlerts, type OfficialNotice } from "./rules";

export interface ReplayFrameInput {
  at: string;
  label: string;
  hotspots: { location: LatLon; observedAt: string }[];
  officials: OfficialNotice[];
}

export interface Detection {
  location: LatLon;
  observedAt: string;
}

export interface ReplayTimeline {
  start: number;
  end: number;
  detections: Detection[];
  /** Each notice from the frame where it first appeared; a later order replaces an alert with the same id. */
  notices: { notice: OfficialNotice; from: number }[];
  captions: { from: number; text: string }[];
}

export interface ReplaySnapshot {
  /** Heat from the last 24 h before t, with its age in hours at t. */
  hotspots: (Detection & { ageH: number })[];
  /** Estimated outlines as GeoJSON rings of [lon, lat]. */
  outlines: [number, number][][];
  alerts: Alert[];
  caption: string;
}

const HOUR = 3600 * 1000;

export function buildTimeline(frames: ReplayFrameInput[]): ReplayTimeline {
  const seen = new Map<string, Detection>();
  const notices = new Map<string, { notice: OfficialNotice; from: number }>();
  for (const f of frames) {
    for (const h of f.hotspots) seen.set(`${h.location.lat},${h.location.lon},${h.observedAt}`, h);
    for (const n of f.officials) {
      const key = `${n.id}:${n.kind}`;
      if (!notices.has(key)) notices.set(key, { notice: n, from: Date.parse(f.at) });
    }
  }
  const detections = [...seen.values()].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const end = Math.max(...frames.map((f) => Date.parse(f.at)));
  // Start a few hours before the first detection: the quiet hours before that make a dull replay.
  const first = detections[0] ? Date.parse(detections[0].observedAt) : Date.parse(frames[0]!.at);
  const start = Math.min(end, Math.floor((first - 3 * HOUR) / HOUR) * HOUR);
  const captions = frames.map((f) => ({ from: Date.parse(f.at), text: f.label.split(" · ").slice(1).join(" · ") || f.label }));
  return { start, end, detections, notices: [...notices.values()].sort((a, b) => a.from - b.from), captions };
}

export function replayAt(tl: ReplayTimeline, home: LatLon, t: number, sensitive: boolean): ReplaySnapshot {
  const sofar = tl.detections.filter((d) => Date.parse(d.observedAt) <= t);
  const hotspots = sofar
    .map((d) => ({ ...d, ageH: (t - Date.parse(d.observedAt)) / HOUR }))
    .filter((d) => d.ageH <= 24);
  const latest = new Map<string, OfficialNotice>();
  for (const n of tl.notices) if (n.from <= t) latest.set(n.notice.id, n.notice);
  const alerts = evaluateAlerts({ now: new Date(t).toISOString(), home, sensitive, hotspots, officials: [...latest.values()], replay: true });
  const caption = [...tl.captions].reverse().find((c) => c.from <= t)?.text ?? "";
  return { hotspots, outlines: estimateOutlines(sofar.map((d) => d.location)), alerts, caption };
}

/**
 * Groups detections that sit within 3 km of each other and wraps each group of 3+ in a convex hull, padded by
 * ~400 m (about one VIIRS pixel). An estimate from satellite heat, never an official perimeter.
 */
export function estimateOutlines(points: LatLon[], linkKm = 3, padKm = 0.4): [number, number][][] {
  const group = points.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (distanceKm(points[i]!, points[j]!) <= linkKm) group[root(i)] = root(j);
    }
  }
  const groups = new Map<number, LatLon[]>();
  points.forEach((p, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), p]));
  const rings: [number, number][][] = [];
  for (const g of groups.values()) {
    if (g.length < 3) continue;
    const padded: [number, number][] = [];
    for (const p of g) {
      const dLat = padKm / 111.32;
      const dLon = padKm / (111.32 * Math.cos((p.lat * Math.PI) / 180));
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        padded.push([p.lon + dLon * Math.cos(a), p.lat + dLat * Math.sin(a)]);
      }
    }
    const hull = convexHull(padded);
    rings.push([...hull, hull[0]!]);
  }
  return rings;
}

/** Andrew's monotone chain; returns the hull counter-clockwise without repeating the first point. */
function convexHull(pts: [number, number][]): [number, number][] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...s].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
