import "server-only";
import {
  describeFlammability,
  findForbiddenClaims,
  isPilotRegion,
  mergeIdentifications,
  OFFICIAL_REPORTING,
  REGION_NAMES,
  vascanVerdict,
  type RegionCode,
  type RegionVerdict,
  type Species,
  type SproutResult,
  type SproutSwap,
  type SproutVerdict,
} from "@sylvia/core";
import { embedText, identifyWithVision, isSafeText, writeExplanation } from "./foundry";
import { identifyWithPlantNet } from "./plantnet";
import { findVerdict, regionData } from "./plants";
import { env } from "./env";

const flammabilityText = (v: RegionVerdict) =>
  describeFlammability({
    rating: v.flammability.rating,
    source: v.flammability.source?.name,
    appliedFromRegion: v.flammability.appliedFromRegion,
  });

/** Runs the whole Sprout pipeline for one photo. */
export async function runSprout(image: Blob, regionCode: RegionCode): Promise<SproutResult> {
  const regionName = REGION_NAMES[regionCode] ?? regionCode;
  const data = await regionData(regionCode);
  const watchList = data.verdicts
    .map((v) => data.species.get(v.speciesId))
    .filter((s): s is Species => !!s)
    .map((s) => ({ scientificName: s.scientificName, commonName: s.commonNames.en[0]! }));

  const dataUrl = `data:${image.type || "image/jpeg"};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  const [vision, plantnet] = await Promise.all([
    identifyWithVision(dataUrl, regionName, watchList).catch((e) => {
      console.error("Vision failed", e);
      return undefined;
    }),
    identifyWithPlantNet(image),
  ]);

  const result: SproutResult = {
    regionCode,
    notPlant: false,
    identification: { level: "low", agreement: false, needsConfirmation: true, alternatives: [], sources: { vision: !!vision, plantnet: plantnet.length > 0 } },
    swaps: [],
  };
  if (vision && !vision.isPlant && plantnet.length === 0) return { ...result, notPlant: true, photoTip: vision.photoTip ?? undefined };

  const id = mergeIdentifications(vision?.candidates ?? [], plantnet);
  const toCandidate = (c: { scientificName: string; commonName?: string; score: number }) => ({
    scientificName: c.scientificName,
    commonName: c.commonName,
    score: Math.round(c.score * 100) / 100,
  });
  result.identification = { ...result.identification, ...id, top: id.top && toCandidate(id.top), alternatives: id.alternatives.map(toCandidate) };
  result.photoTip = vision?.photoTip ?? undefined;
  if (!id.top) return result;

  // Verdict: curated first, VASCAN (native / introduced only) otherwise.
  const curated = findVerdict(data, id.top.scientificName);
  if (curated) {
    result.verdict = {
      speciesId: curated.speciesId,
      status: curated.status,
      confidence: curated.confidence,
      invasiveRank: curated.invasiveRank,
      harm: curated.harm,
      flammability: flammabilityText(curated),
      flammabilityRating: curated.flammability.rating,
      source: curated.statusSource,
      reviewed: curated.review.status === "reviewed",
    };
  } else {
    const fb = await vascanVerdict(id.top.scientificName, regionCode).catch(() => undefined);
    result.verdict = {
      status: fb?.status ?? "unknown",
      confidence: "lower",
      flammability: "Flammability not rated",
      flammabilityRating: "not-rated",
      source: fb?.source ?? { name: "No regional record found" },
      reviewed: false,
    } satisfies SproutVerdict;
  }

  if (result.verdict.status === "invasive") {
    result.report = OFFICIAL_REPORTING[regionCode];
    result.swaps = await swapsFor(curated, data, vision?.appearance, regionCode);
  }

  result.explanation = await explain(result, regionName, isPilotRegion(regionCode));
  return result;
}

async function swapsFor(
  curated: RegionVerdict | undefined,
  data: Awaited<ReturnType<typeof regionData>>,
  appearance: string | undefined,
  regionCode: string,
): Promise<SproutSwap[]> {
  const nativeVerdict = (id: string) => data.verdicts.find((v) => v.speciesId === id && v.status === "native");
  const swaps: SproutSwap[] = [];
  for (const s of curated?.swaps ?? []) {
    const sp = data.species.get(s.speciesId);
    const nv = nativeVerdict(s.speciesId);
    if (!sp || !nv) continue;
    swaps.push({
      speciesId: sp.id,
      commonName: sp.commonNames.en[0]!,
      scientificName: sp.scientificName,
      why: s.why,
      flammability: flammabilityText(nv),
      kind: "curated",
      reviewed: s.reviewStatus === "reviewed" && nv.review.status === "reviewed",
    });
  }
  // Fill up to three with native look-alikes from AI Search.
  const text = appearance ?? (curated ? data.species.get(curated.speciesId)?.appearance : undefined);
  if (text && swaps.length < 3) {
    try {
      for (const hit of await lookAlikes(text, regionCode, 4)) {
        if (swaps.length >= 3 || swaps.some((s) => s.speciesId === hit.speciesId)) continue;
        const sp = data.species.get(hit.speciesId);
        const nv = nativeVerdict(hit.speciesId);
        if (!sp || !nv) continue;
        swaps.push({
          speciesId: sp.id,
          commonName: sp.commonNames.en[0]!,
          scientificName: sp.scientificName,
          flammability: flammabilityText(nv),
          kind: "look-alike",
          reviewed: nv.review.status === "reviewed",
        });
      }
    } catch (e) {
      console.warn("Look-alike search failed", e);
    }
  }
  return swaps;
}

async function lookAlikes(text: string, regionCode: string, k: number) {
  const vector = await embedText(text);
  const res = await fetch(`${env("SEARCH_ENDPOINT")}/indexes/native-plants/docs/search?api-version=2024-07-01`, {
    method: "POST",
    headers: { "api-key": env("SEARCH_KEY"), "content-type": "application/json" },
    body: JSON.stringify({
      filter: `regionCode eq '${regionCode}'`,
      vectorQueries: [{ kind: "vector", vector, fields: "embedding", k }],
      select: "speciesId",
      top: k,
    }),
  });
  if (!res.ok) throw new Error(`Search ${res.status}`);
  return ((await res.json()) as { value: { speciesId: string }[] }).value;
}

/** Facts for Sylvia's explanation. Only what we can back with a source. */
export function factsFor(r: SproutResult, regionName: string): string {
  const v = r.verdict!;
  const top = r.identification.top!;
  const lines = [
    `Plant: ${top.commonName ?? top.scientificName} (${top.scientificName}). Identification confidence: ${r.identification.level}.`,
    `Region: ${regionName}. Status here: ${v.status} (source: ${v.source.name}${v.confidence === "lower" ? ", lower confidence" : ""}).`,
    v.harm ? `Why it matters: ${v.harm}` : "",
    `Flammability: ${v.flammability}.`,
    r.swaps.length ? `Native swaps: ${r.swaps.map((s) => s.commonName + (s.why ? ` (${s.why})` : "")).join("; ")}.` : "",
    r.report ? `Official reporting: ${r.report.label}.` : "",
    v.reviewed ? "" : "This information is not yet reviewed by our team.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function explain(r: SproutResult, regionName: string, pilot: boolean): Promise<string | undefined> {
  if (!r.verdict || !r.identification.top) return undefined;
  try {
    const text = await writeExplanation(factsFor(r, regionName) + (pilot ? "" : "\nThis region is outside our pilot areas."));
    if (findForbiddenClaims(text) || !(await isSafeText(text))) return undefined;
    return text;
  } catch (e) {
    console.warn("Explanation failed", e);
    return undefined;
  }
}
