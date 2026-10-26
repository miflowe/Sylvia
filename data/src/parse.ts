// Reads the curation CSVs, converts each row to a typed document and validates it with the shared schemas.
// Errors carry file and row numbers so the team can fix the sheet directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import {
  findForbiddenClaims,
  NurserySchema,
  RegionVerdictSchema,
  SpeciesSchema,
  isPilotRegion,
  type Nursery,
  type RegionVerdict,
  type Source,
  type Species,
} from "@sylvia/core";

export interface Curation {
  species: Species[];
  verdicts: RegionVerdict[];
  nurseries: Nursery[];
  errors: string[];
}

type Row = Record<string, string>;

const list = (v = "") => v.split(";").map((s) => s.trim()).filter(Boolean);
const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);
const num = (v?: string) => (opt(v) === undefined ? undefined : Number(v));
const source = (name?: string, url?: string): Source | undefined =>
  opt(name) ? { name: name!.trim(), ...(opt(url) ? { url: url!.trim() } : {}) } : undefined;

function readCsv(dir: string, file: string): Row[] {
  const text = readFileSync(join(dir, file), "utf8").replace(/^﻿/, "");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
}

function issues(file: string, row: number, err: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return err.issues.map((i) => `${file} row ${row}: ${i.path.join(".") || "row"}: ${i.message}`);
}

export function loadCuration(dir: string): Curation {
  const errors: string[] = [];
  const species: Species[] = [];
  const verdicts: RegionVerdict[] = [];
  const nurseries: Nursery[] = [];

  // Row numbers match what Excel shows: the header is row 1.
  readCsv(dir, "species.csv").forEach((r, i) => {
    const doc = {
      id: r.species_id,
      scientificName: r.scientific_name,
      commonNames: { en: list(r.common_name_en), fr: list(r.common_name_fr) },
      family: opt(r.family),
      growthForm: r.growth_form,
      sun: list(r.sun),
      moisture: list(r.moisture),
      heightM: [num(r.height_min_m), num(r.height_max_m)],
      bloomColours: list(r.bloom_colours),
      evergreen: r.evergreen?.toLowerCase() === "yes",
      pollinatorValue: opt(r.pollinator_value),
      appearance: r.appearance,
      gbifKey: num(r.gbif_key),
      imageUrl: opt(r.image_url),
      sources: [source(r.source_name, r.source_url)].filter(Boolean),
    };
    const res = SpeciesSchema.safeParse(doc);
    if (res.success) species.push(res.data);
    else errors.push(...issues("species.csv", i + 2, res.error));
  });
  const speciesIds = new Set(species.map((s) => s.id));

  readCsv(dir, "region_verdicts.csv").forEach((r, i) => {
    const row = i + 2;
    const doc = {
      id: `${r.region_code}:${r.species_id}`,
      regionCode: r.region_code,
      speciesId: r.species_id,
      status: r.status,
      invasiveRank: opt(r.invasive_rank),
      harm: opt(r.harm_plain),
      statusSource: source(r.status_source_name, r.status_source_url),
      flammability: {
        rating: r.flammability || "not-rated",
        source: source(r.flammability_source_name, r.flammability_source_url),
        appliedFromRegion: opt(r.flammability_applied_from),
      },
      swaps: [],
      confidence: isPilotRegion(r.region_code ?? "") ? "curated" : "lower",
      review: { status: r.review_status || "draft", by: opt(r.reviewed_by), at: opt(r.reviewed_at) },
    };
    const res = RegionVerdictSchema.safeParse(doc);
    if (!res.success) return void errors.push(...issues("region_verdicts.csv", row, res.error));
    if (!speciesIds.has(res.data.speciesId)) errors.push(`region_verdicts.csv row ${row}: species ${res.data.speciesId} is not in species.csv`);
    const banned = findForbiddenClaims(res.data.harm ?? "");
    if (banned) errors.push(`region_verdicts.csv row ${row}: harm note says "${banned}"; no plant is fireproof`);
    verdicts.push(res.data);
  });
  const verdictById = new Map(verdicts.map((v) => [v.id, v]));

  readCsv(dir, "swaps.csv").forEach((r, i) => {
    const row = i + 2;
    const invasive = verdictById.get(`${r.region_code}:${r.invasive_species_id}`);
    const native = verdictById.get(`${r.region_code}:${r.native_species_id}`);
    if (!invasive) return void errors.push(`swaps.csv row ${row}: no verdict for ${r.region_code}:${r.invasive_species_id}`);
    if (invasive.status !== "invasive") errors.push(`swaps.csv row ${row}: ${r.invasive_species_id} is not marked invasive in ${r.region_code}`);
    if (native?.status !== "native") return void errors.push(`swaps.csv row ${row}: ${r.native_species_id} needs a native verdict in ${r.region_code}`);
    const why = opt(r.why) ?? "";
    const banned = findForbiddenClaims(why);
    if (banned) errors.push(`swaps.csv row ${row}: "why" says "${banned}"; no plant is fireproof`);
    const src = source(r.source_name, r.source_url);
    if (!src) return void errors.push(`swaps.csv row ${row}: source_name is required`);
    if (why.length < 5) return void errors.push(`swaps.csv row ${row}: why is required`);
    invasive.swaps.push({
      speciesId: r.native_species_id!,
      why,
      source: src,
      reviewStatus: r.review_status === "reviewed" ? "reviewed" : "draft",
    });
  });

  readCsv(dir, "nurseries.csv").forEach((r, i) => {
    const doc = {
      id: `${r.region_code}:${r.name}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-"),
      regionCode: r.region_code,
      name: r.name,
      city: r.city,
      location: { type: "Point", coordinates: [num(r.longitude), num(r.latitude)] },
      programs: list(r.programs),
      website: opt(r.website),
      source: source(r.source_name, r.source_url),
    };
    const res = NurserySchema.safeParse(doc);
    if (res.success) nurseries.push(res.data);
    else errors.push(...issues("nurseries.csv", i + 2, res.error));
  });

  return { species, verdicts, nurseries, errors };
}
