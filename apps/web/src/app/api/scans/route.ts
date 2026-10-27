import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SavedScanInputSchema, type SavedScan } from "@sylvia/core";
import { container } from "@/server/cosmos";
import { ownerId } from "@/server/device";
import { putPhoto } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noDevice = () => NextResponse.json({ error: "Missing device id." }, { status: 400 });

/** The device's saved scans, newest first. */
export async function GET(req: Request) {
  const device = await ownerId(req);
  if (!device) return noDevice();
  const { resources } = await container("scans")
    .items.query<SavedScan>(
      { query: "SELECT * FROM c WHERE c.deviceOrUserId = @d ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50", parameters: [{ name: "@d", value: device }] },
      { partitionKey: device },
    )
    .fetchAll();
  return NextResponse.json(resources.map(({ id, regionCode, scientificName, commonName, speciesId, status, flammability, swaps, createdAt, hasPhoto }) => ({ id, regionCode, scientificName, commonName, speciesId, status, flammability, swaps, createdAt, hasPhoto })));
}

/** Save a scan: multipart with `scan` (JSON) and optional `image` (JPEG, ≤4 MB). */
export async function POST(req: Request) {
  const device = await ownerId(req);
  if (!device) return noDevice();
  const form = await req.formData().catch(() => undefined);
  let raw: unknown;
  try {
    raw = JSON.parse(String(form?.get("scan") ?? ""));
  } catch {
    raw = undefined;
  }
  const input = SavedScanInputSchema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: "That scan couldn't be saved." }, { status: 400 });

  const id = randomUUID();
  const image = form?.get("image");
  let hasPhoto = false;
  if (image instanceof Blob && image.type === "image/jpeg" && image.size <= 4 * 1024 * 1024) {
    await putPhoto(device, id, Buffer.from(await image.arrayBuffer()));
    hasPhoto = true;
  }
  const scan: SavedScan = { ...input.data, id, deviceOrUserId: device, createdAt: new Date().toISOString(), hasPhoto };
  await container("scans").items.create(scan);
  return NextResponse.json({ id, createdAt: scan.createdAt }, { status: 201 });
}
