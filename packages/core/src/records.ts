import { z } from "zod";
import { RegionCodeSchema } from "./plants";

/** A scan the person chose to save. Lives in the `scans` container, partitioned by device (or user later). */
export const SavedScanInputSchema = z.object({
  regionCode: RegionCodeSchema,
  scientificName: z.string().min(3).max(120),
  commonName: z.string().max(120).optional(),
  speciesId: z.string().max(120).optional(),
  status: z.enum(["native", "introduced", "invasive", "unknown"]),
  flammability: z.string().max(200),
  swaps: z.array(z.object({ speciesId: z.string().max(120), commonName: z.string().max(120) })).max(5),
});
export type SavedScanInput = z.infer<typeof SavedScanInputSchema>;

export interface SavedScan extends SavedScanInput {
  id: string;
  deviceOrUserId: string;
  createdAt: string;
  hasPhoto: boolean;
}

/** Opt-in invasive sighting. Stores no device id and only ~1 km location. */
export const SightingInputSchema = z.object({
  regionCode: RegionCodeSchema,
  scientificName: z.string().min(3).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  consent: z.literal(true),
});

export interface Sighting {
  id: string;
  cellId: string;
  regionCode: string;
  speciesId: string;
  commonName: string;
  location: { type: "Point"; coordinates: [number, number] };
  createdAt: string; // date only, to the day
}

export interface NearbyNursery {
  name: string;
  address?: string;
  distanceKm: number;
  location: { lat: number; lon: number };
  programs: ("grow-me-instead" | "firesmart-bc")[];
  website?: string;
  source: "curated" | "azure-maps";
}
