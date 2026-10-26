import type { ConfidenceLevel } from "./identify";

/** What /api/sprout returns to the app. Shared so client and server agree. */
export interface SproutResult {
  regionCode: string;
  notPlant: boolean;
  photoTip?: string;
  identification: {
    level: ConfidenceLevel;
    agreement: boolean;
    needsConfirmation: boolean;
    top?: SproutCandidate;
    alternatives: SproutCandidate[];
    sources: { vision: boolean; plantnet: boolean };
    /** Set when the person picked this species from the alternatives. */
    confirmedByUser?: boolean;
  };
  verdict?: SproutVerdict;
  swaps: SproutSwap[];
  /** Sylvia's first-person explanation, grounded in the verdict. */
  explanation?: string;
  report?: { label: string; url: string };
}

export interface SproutCandidate {
  scientificName: string;
  commonName?: string;
  score: number;
}

export interface SproutVerdict {
  speciesId?: string;
  status: "native" | "introduced" | "invasive" | "unknown";
  confidence: "curated" | "lower";
  invasiveRank?: "high" | "moderate" | "watch";
  harm?: string;
  flammability: string;
  flammabilityRating: "low" | "moderate" | "high" | "not-rated";
  source: { name: string; url?: string };
  reviewed: boolean;
}

export interface SproutSwap {
  speciesId: string;
  commonName: string;
  scientificName: string;
  why?: string;
  flammability: string;
  kind: "curated" | "look-alike";
  reviewed: boolean;
}

export const OFFICIAL_REPORTING: Record<string, { label: string; url: string }> = {
  "CA-ON": { label: "Report it on EDDMapS Ontario", url: "https://www.eddmaps.org/ontario/" },
  "CA-BC": { label: "Report it to the Invasive Species Council of BC", url: "https://bcinvasives.ca/" },
};

export const REGION_NAMES: Record<string, string> = {
  "CA-ON": "Ontario",
  "CA-BC": "British Columbia",
};
