// The `native-plants` Azure AI Search index: one document per native species per region, with an embedding of
// its appearance so Sprout can find native look-alikes for an invasive plant.
import type { RegionVerdict, Species } from "@sylvia/core";

export const INDEX_NAME = "native-plants";
export const EMBEDDING_DEPLOYMENT = "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 1024;
const SEARCH_API = "2024-07-01";
const OPENAI_API = "2024-10-21";

export interface NativePlantDoc {
  id: string;
  regionCode: string;
  speciesId: string;
  scientificName: string;
  commonName: string;
  growthForm: string;
  sun: string[];
  moisture: string[];
  heightMaxM: number;
  bloomColours: string[];
  evergreen: boolean;
  flammability: string;
  pollinatorValue: string | null;
  appearance: string;
  reviewed: boolean;
  embedding?: number[];
}

export const indexDefinition = {
  name: INDEX_NAME,
  fields: [
    { name: "id", type: "Edm.String", key: true, filterable: true },
    { name: "regionCode", type: "Edm.String", filterable: true, facetable: true },
    { name: "speciesId", type: "Edm.String", filterable: true },
    { name: "scientificName", type: "Edm.String", searchable: true },
    { name: "commonName", type: "Edm.String", searchable: true },
    { name: "growthForm", type: "Edm.String", filterable: true, facetable: true },
    { name: "sun", type: "Collection(Edm.String)", filterable: true },
    { name: "moisture", type: "Collection(Edm.String)", filterable: true },
    { name: "heightMaxM", type: "Edm.Double", filterable: true, sortable: true },
    { name: "bloomColours", type: "Collection(Edm.String)", filterable: true, searchable: true },
    { name: "evergreen", type: "Edm.Boolean", filterable: true },
    { name: "flammability", type: "Edm.String", filterable: true },
    { name: "pollinatorValue", type: "Edm.String", filterable: true },
    { name: "appearance", type: "Edm.String", searchable: true },
    { name: "reviewed", type: "Edm.Boolean", filterable: true },
    {
      name: "embedding",
      type: "Collection(Edm.Single)",
      searchable: true,
      retrievable: false,
      dimensions: EMBEDDING_DIMENSIONS,
      vectorSearchProfile: "appearance-profile",
    },
  ],
  vectorSearch: {
    algorithms: [{ name: "hnsw", kind: "hnsw" }],
    profiles: [{ name: "appearance-profile", algorithm: "hnsw" }],
  },
};

/** The text we embed: what the plant looks like, in the words a gardener would use. */
export function embeddingText(s: Species): string {
  const colours = s.bloomColours.length ? ` Flowers: ${s.bloomColours.join(", ")}.` : "";
  return `${s.commonNames.en[0]} (${s.scientificName}), ${s.evergreen ? "evergreen " : ""}${s.growthForm} up to ${s.heightM[1]} m. ${s.appearance}${colours}`;
}

export function searchDocFor(v: RegionVerdict, s: Species): NativePlantDoc {
  return {
    id: `${v.regionCode}-${v.speciesId}`, // search keys can't contain ":"
    regionCode: v.regionCode,
    speciesId: v.speciesId,
    scientificName: s.scientificName,
    commonName: s.commonNames.en[0]!,
    growthForm: s.growthForm,
    sun: s.sun,
    moisture: s.moisture,
    heightMaxM: s.heightM[1],
    bloomColours: s.bloomColours,
    evergreen: s.evergreen,
    flammability: v.flammability.rating,
    pollinatorValue: s.pollinatorValue ?? null,
    appearance: s.appearance,
    reviewed: v.review.status === "reviewed",
  };
}

export async function embed(endpoint: string, key: string, inputs: string[]): Promise<number[][]> {
  const res = await fetch(
    `${endpoint.replace(/\/$/, "")}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=${OPENAI_API}`,
    {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ input: inputs, dimensions: EMBEDDING_DIMENSIONS }),
    },
  );
  if (!res.ok) throw new Error(`Embeddings failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function searchCall(endpoint: string, key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${endpoint.replace(/\/$/, "")}${path}${path.includes("?") ? "&" : "?"}api-version=${SEARCH_API}`, {
    method,
    headers: { "api-key": key, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Search ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? undefined : res.json();
}

export const putIndex = (endpoint: string, key: string) =>
  searchCall(endpoint, key, "PUT", `/indexes/${INDEX_NAME}`, indexDefinition);

export const uploadDocs = (endpoint: string, key: string, docs: NativePlantDoc[]) =>
  searchCall(endpoint, key, "POST", `/indexes/${INDEX_NAME}/docs/index`, {
    value: docs.map((d) => ({ "@search.action": "mergeOrUpload", ...d })),
  });

/** Native look-alikes for a plant description, within one region. */
export async function lookAlikes(endpoint: string, key: string, vector: number[], regionCode: string, top = 3) {
  const body = (await searchCall(endpoint, key, "POST", `/indexes/${INDEX_NAME}/docs/search`, {
    filter: `regionCode eq '${regionCode}'`,
    vectorQueries: [{ kind: "vector", vector, fields: "embedding", k: top }],
    select: "speciesId,commonName,flammability,reviewed",
    top,
  })) as { value: { speciesId: string; commonName: string; flammability: string; "@search.score": number }[] };
  return body.value;
}
