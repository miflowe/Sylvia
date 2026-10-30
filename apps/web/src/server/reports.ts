import "server-only";
import { createHash } from "node:crypto";
import {
  cellIdFor,
  REPORT_KINDS,
  REPORT_LIMITS,
  REPORT_NOTE_MAX,
  REPORT_TTL_SECONDS,
  roundToKm,
  type ReportKind,
  type ResidentReport,
} from "@sylvia/core";
import { container } from "./cosmos";
import { isSafeImage, isSafeText } from "./foundry";
import { getReportPhoto, putReportPhoto } from "./storage";

interface ReportDoc {
  id: string;
  cellId: string;
  kind: ReportKind;
  location: { type: "Point"; coordinates: [number, number] };
  reporter: string;
  createdAt: string;
  note?: string;
  hasPhoto: boolean;
  ttl: number;
}

/** One-way hash of the device id: enough to count distinct people and rate-limit, not to identify anyone. */
const reporterOf = (device: string) => createHash("sha256").update(`sylvia-report:${device}`).digest("hex").slice(0, 24);

export type CreateResult = { ok: true; id: string } | { ok: false; status: number; error: string };

export async function createReport(input: { device: string; kind: string; lat: number; lon: number; note?: string; photo?: Buffer }): Promise<CreateResult> {
  const kind = REPORT_KINDS.find((k) => k.kind === input.kind)?.kind;
  if (!kind) return { ok: false, status: 400, error: "Choose what you see." };
  const note = input.note?.trim().slice(0, REPORT_NOTE_MAX) || undefined;
  const reporter = reporterOf(input.device);
  const reports = container("reports");

  // Limits per device, so one person can't flood the map.
  const count = async (sinceMs: number) =>
    (
      await reports.items
        .query<number>({
          query: "SELECT VALUE COUNT(1) FROM c WHERE c.reporter = @r AND c.createdAt >= @since",
          parameters: [{ name: "@r", value: reporter }, { name: "@since", value: new Date(Date.now() - sinceMs).toISOString() }],
        })
        .fetchAll()
    ).resources[0] ?? 0;
  const [lastHour, lastDay] = await Promise.all([count(3600e3), count(24 * 3600e3)]);
  if (lastHour >= REPORT_LIMITS.perHour || lastDay >= REPORT_LIMITS.perDay) {
    return { ok: false, status: 429, error: "Thanks, you've sent several reports already. Please try again later. If you see flames, call 911." };
  }

  // Azure AI Content Safety on anything people can read or see.
  const [noteOk, photoOk] = await Promise.all([note ? isSafeText(note) : true, input.photo ? isSafeImage(input.photo) : true]);
  if (!noteOk || !photoOk) return { ok: false, status: 422, error: "This report couldn't be shared. Please describe only what you see." };

  const at = roundToKm({ lat: input.lat, lon: input.lon });
  const createdAt = new Date().toISOString();
  // The same person reporting the same thing in the same place within half an hour counts once.
  const bucket = Math.floor(Date.now() / (30 * 60e3));
  const id = createHash("sha256").update(`${reporter}:${kind}:${at.lat},${at.lon}:${bucket}`).digest("hex").slice(0, 32);
  if (input.photo) await putReportPhoto(id, input.photo);
  const doc: ReportDoc = {
    id,
    cellId: cellIdFor(at),
    kind,
    location: { type: "Point", coordinates: [at.lon, at.lat] },
    reporter,
    createdAt,
    ...(note ? { note } : {}),
    hasPhoto: !!input.photo,
    ttl: REPORT_TTL_SECONDS,
  };
  await reports.items.upsert(doc);
  return { ok: true, id };
}

const toReport = (d: ReportDoc): ResidentReport => ({
  id: d.id,
  kind: d.kind,
  location: { lat: d.location.coordinates[1], lon: d.location.coordinates[0] },
  reporter: d.reporter,
  createdAt: d.createdAt,
  note: d.note,
  hasPhoto: d.hasPhoto,
});

/** Reports inside a GeoJSON polygon (Cosmos deletes them after 6 hours). */
export async function reportsWithin(box: { type: "Polygon"; coordinates: number[][][] }): Promise<ResidentReport[]> {
  const { resources } = await container("reports")
    .items.query<ReportDoc>({ query: "SELECT * FROM c WHERE ST_WITHIN(c.location, @box)", parameters: [{ name: "@box", value: box }] })
    .fetchAll();
  return resources.map(toReport);
}

/** A report's photo, only while the report itself still exists. */
export async function reportPhoto(id: string): Promise<Buffer | undefined> {
  if (!/^[a-f0-9]{32}$/.test(id)) return undefined;
  const { resources } = await container("reports")
    .items.query<{ id: string }>({ query: "SELECT c.id FROM c WHERE c.id = @id AND c.hasPhoto = true", parameters: [{ name: "@id", value: id }] })
    .fetchAll();
  return resources.length ? getReportPhoto(id) : undefined;
}
