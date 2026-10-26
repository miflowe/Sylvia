/**
 * Merges two independent identifications of one plant photo: gpt-4o vision (Azure AI Foundry) and Pl@ntNet.
 * Agreement raises confidence; disagreement lowers it and asks the person to confirm.
 */

export interface Candidate {
  scientificName: string;
  commonName?: string;
  /** 0–1, as reported by the source. */
  score: number;
  gbifKey?: number;
}

export interface MergedCandidate {
  key: string; // binomial, lowercase: "berberis thunbergii"
  scientificName: string;
  commonName?: string;
  score: number; // 0–1 combined
  vision?: number;
  plantnet?: number;
  gbifKey?: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Identification {
  top?: MergedCandidate;
  alternatives: MergedCandidate[];
  level: ConfidenceLevel;
  agreement: boolean;
  needsConfirmation: boolean;
}

/** Genus + species only, so authors and subspecies don't stop two sources matching. */
export function binomialKey(scientificName: string): string {
  return scientificName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "x")
    .slice(0, 2)
    .join(" ");
}

const SINGLE_SOURCE_WEIGHT = 0.6;

export function mergeIdentifications(vision: Candidate[], plantnet: Candidate[]): Identification {
  const merged = new Map<string, MergedCandidate>();
  const add = (c: Candidate, source: "vision" | "plantnet") => {
    const key = binomialKey(c.scientificName);
    if (!key.includes(" ")) return; // genus-only answers aren't useful for a verdict
    const m = merged.get(key) ?? { key, scientificName: c.scientificName, score: 0 };
    m[source] = Math.max(m[source] ?? 0, clamp(c.score));
    m.commonName ??= c.commonName;
    m.gbifKey ??= c.gbifKey;
    // Prefer Pl@ntNet's clean scientific name when both exist.
    if (source === "plantnet") m.scientificName = c.scientificName;
    merged.set(key, m);
  };
  vision.forEach((c) => add(c, "vision"));
  plantnet.forEach((c) => add(c, "plantnet"));

  for (const m of merged.values()) {
    m.score =
      m.vision !== undefined && m.plantnet !== undefined
        ? (m.vision + m.plantnet) / 2
        : (m.vision ?? m.plantnet ?? 0) * SINGLE_SOURCE_WEIGHT;
  }
  const ranked = [...merged.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const topOf = (list: Candidate[]) => (list.length ? binomialKey([...list].sort((a, b) => b.score - a.score)[0]!.scientificName) : undefined);
  const agreement = !!top && topOf(vision) === top.key && topOf(plantnet) === top.key;
  const level: ConfidenceLevel = !top ? "low" : agreement && top.score >= 0.6 ? "high" : top.score >= 0.35 ? "medium" : "low";

  return {
    top,
    alternatives: ranked.slice(1, 3),
    level,
    agreement,
    needsConfirmation: level !== "high",
  };
}

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
