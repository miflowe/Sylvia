import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cellIdFor, roundForSighting, SightingInputSchema, type Sighting } from "@sylvia/core";
import { container } from "@/server/cosmos";
import { findVerdict, regionData } from "@/server/plants";

export const runtime = "nodejs";

/**
 * Log an opt-in sighting of an invasive plant. Only curated invasive species are accepted. Stores ~1 km location
 * and the date, with no device or account link.
 */
export async function POST(req: Request) {
  const input = SightingInputSchema.safeParse(await req.json().catch(() => undefined));
  if (!input.success) return NextResponse.json({ error: "Sightings need your consent, a region and a location." }, { status: 400 });
  const { regionCode, scientificName, lat, lon } = input.data;

  const data = await regionData(regionCode);
  const verdict = findVerdict(data, scientificName);
  if (verdict?.status !== "invasive") {
    return NextResponse.json({ error: "Only plants on the invasive list for your region can be reported here." }, { status: 422 });
  }
  const at = roundForSighting({ lat, lon });
  const sighting: Sighting = {
    id: randomUUID(),
    cellId: cellIdFor(at),
    regionCode,
    speciesId: verdict.speciesId,
    commonName: data.species.get(verdict.speciesId)?.commonNames.en[0] ?? scientificName,
    location: { type: "Point", coordinates: [at.lon, at.lat] },
    createdAt: new Date().toISOString().slice(0, 10),
  };
  await container("sightings").items.create(sighting);
  return NextResponse.json({ id: sighting.id, rounded: at }, { status: 201 });
}
