import "server-only";
import type { Candidate } from "@sylvia/core";
import { env, hasEnv } from "./env";

interface PlantNetResponse {
  results?: {
    score: number;
    species: { scientificNameWithoutAuthor: string; commonNames?: string[] };
    gbif?: { id?: string | number };
  }[];
}

/** Pl@ntNet second opinion. Returns [] when it has no match or isn't configured; never blocks a scan. */
export async function identifyWithPlantNet(image: Blob): Promise<Candidate[]> {
  if (!hasEnv("PLANTNET_API_KEY")) return [];
  const form = new FormData();
  form.append("images", image, "plant.jpg");
  form.append("organs", "auto");
  const url = `https://my-api.plantnet.org/v2/identify/all?nb-results=5&lang=en&include-related-images=false&api-key=${encodeURIComponent(env("PLANTNET_API_KEY"))}`;
  try {
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
    if (res.status === 404) return []; // "Species not found"
    if (!res.ok) {
      console.warn(`Pl@ntNet ${res.status}`);
      return [];
    }
    const body = (await res.json()) as PlantNetResponse;
    return (body.results ?? []).map((r) => ({
      scientificName: r.species.scientificNameWithoutAuthor,
      commonName: r.species.commonNames?.[0],
      score: r.score,
      gbifKey: r.gbif?.id ? Number(r.gbif.id) : undefined,
    }));
  } catch (e) {
    console.warn("Pl@ntNet failed", e);
    return [];
  }
}
