import { z } from "zod";

/**
 * Plant data shared by the importer, the API and the app. Every claim carries a source; curated rows start as
 * drafts and only `reviewed` rows count as curated in production.
 */

export const SourceSchema = z.object({
  name: z.string().min(2),
  url: z.string().url().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const RegionCodeSchema = z.string().regex(/^(CA|US)-[A-Z]{2}$/, "Region codes look like CA-ON or CA-BC");

/** Lowercase, hyphenated scientific name: "Berberis thunbergii" → "berberis-thunbergii". */
export function speciesIdFor(scientificName: string): string {
  return scientificName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export const SpeciesIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)+$/, "Use the hyphenated scientific name, e.g. berberis-thunbergii");

export const GROWTH_FORMS = ["tree", "shrub", "vine", "forb", "grass", "fern", "groundcover", "aquatic"] as const;
export const SUN = ["full", "part", "shade"] as const;
export const MOISTURE = ["dry", "medium", "wet"] as const;

export const SpeciesSchema = z
  .object({
    id: SpeciesIdSchema,
    scientificName: z.string().min(3),
    commonNames: z.object({ en: z.array(z.string()).min(1), fr: z.array(z.string()).default([]) }),
    family: z.string().optional(),
    growthForm: z.enum(GROWTH_FORMS),
    sun: z.array(z.enum(SUN)).min(1),
    moisture: z.array(z.enum(MOISTURE)).min(1),
    heightM: z.tuple([z.number().nonnegative(), z.number().positive()]),
    bloomColours: z.array(z.string()).default([]),
    evergreen: z.boolean().default(false),
    pollinatorValue: z.enum(["high", "medium", "low"]).optional(),
    /** Plain description of how it looks; used for "looks like" matching. */
    appearance: z.string().min(20),
    gbifKey: z.number().int().optional(),
    imageUrl: z.string().url().optional(),
    sources: z.array(SourceSchema).min(1),
  })
  .refine((s) => s.heightM[0] <= s.heightM[1], {
    message: "height_min_m must not exceed height_max_m",
    path: ["heightM"],
  });
export type Species = z.infer<typeof SpeciesSchema>;

export const STATUSES = ["native", "introduced", "invasive", "unknown"] as const;
export const FLAMMABILITY = ["low", "moderate", "high", "not-rated"] as const;

export const SwapSchema = z.object({
  speciesId: SpeciesIdSchema,
  why: z.string().min(5),
  source: SourceSchema,
});
export type Swap = z.infer<typeof SwapSchema>;

export const RegionVerdictSchema = z
  .object({
    id: z.string(), // `${regionCode}:${speciesId}`
    regionCode: RegionCodeSchema,
    speciesId: SpeciesIdSchema,
    status: z.enum(STATUSES),
    invasiveRank: z.enum(["high", "moderate", "watch"]).optional(),
    /** Plain-language harm, Grade 8 reading level. Required for invasive plants. */
    harm: z.string().optional(),
    statusSource: SourceSchema,
    flammability: z.object({
      rating: z.enum(FLAMMABILITY),
      source: SourceSchema.optional(),
      appliedFromRegion: RegionCodeSchema.optional(),
    }),
    swaps: z.array(SwapSchema).default([]),
    confidence: z.enum(["curated", "lower"]),
    review: z.object({
      status: z.enum(["draft", "reviewed"]),
      by: z.string().optional(),
      at: z.string().optional(),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.id !== `${v.regionCode}:${v.speciesId}`) {
      ctx.addIssue({ code: "custom", message: "id must be regionCode:speciesId", path: ["id"] });
    }
    if (v.status === "invasive" && !v.harm) {
      ctx.addIssue({ code: "custom", message: "Invasive plants need a plain-language harm note", path: ["harm"] });
    }
    if (v.flammability.rating !== "not-rated" && !v.flammability.source) {
      ctx.addIssue({
        code: "custom",
        message: "A flammability rating needs a source (or use not-rated)",
        path: ["flammability", "source"],
      });
    }
    if (v.review.status === "reviewed" && !v.review.by) {
      ctx.addIssue({ code: "custom", message: "Reviewed rows need reviewed_by", path: ["review", "by"] });
    }
  });
export type RegionVerdict = z.infer<typeof RegionVerdictSchema>;

export const NurserySchema = z.object({
  id: z.string(),
  regionCode: RegionCodeSchema,
  name: z.string().min(2),
  city: z.string().min(2),
  /** GeoJSON point: [longitude, latitude]. */
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  programs: z.array(z.enum(["grow-me-instead", "firesmart-bc"])).min(1),
  website: z.string().url().optional(),
  source: SourceSchema,
});
export type Nursery = z.infer<typeof NurserySchema>;

/** Claims a plant record must never make: no plant is fireproof. */
const FORBIDDEN = /\b(fire[- ]?proof|non[- ]?flammable|won't burn|will not burn)\b/i;
export function findForbiddenClaims(text: string): string | undefined {
  return text.match(FORBIDDEN)?.[0];
}
