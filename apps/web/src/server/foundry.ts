import "server-only";
import type { Candidate } from "@sylvia/core";
import { env } from "./env";

// Azure AI Foundry (Sweden Central): gpt-4o for vision and text, text-embedding-3-large, and Content Safety.
const OPENAI_API = "2024-10-21";
const SAFETY_API = "2024-09-01";

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env("AZURE_AI_ENDPOINT")}${path}`, {
    method: "POST",
    // OpenAI routes read api-key; Content Safety reads Ocp-Apim-Subscription-Key.
    headers: { "api-key": env("AZURE_AI_KEY"), "Ocp-Apim-Subscription-Key": env("AZURE_AI_KEY"), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Foundry ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

interface ChatResponse {
  choices: { message: { content: string } }[];
}

export interface VisionResult {
  isPlant: boolean;
  candidates: Candidate[];
  appearance: string;
  photoTip: string | null;
}

const visionSchema = {
  name: "plant_identification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["isPlant", "candidates", "appearance", "photoTip"],
    properties: {
      isPlant: { type: "boolean" },
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["scientificName", "commonName", "confidence"],
          properties: {
            scientificName: { type: "string" },
            commonName: { type: "string" },
            confidence: { type: "number" },
          },
        },
      },
      appearance: { type: "string" },
      photoTip: { type: ["string", "null"] },
    },
  },
};

export async function identifyWithVision(
  imageDataUrl: string,
  regionName: string,
  regionSpecies: { scientificName: string; commonName: string }[],
): Promise<VisionResult> {
  const watchList = regionSpecies.map((s) => `- ${s.scientificName} (${s.commonName})`).join("\n");
  const system = `You identify plants from photos for homeowners in ${regionName}, Canada.
Return up to 3 candidate species, most likely first, with honest confidence from 0 to 1. Use accepted scientific names (genus and species).
Plants of special interest in this region are listed below. Prefer one only when the photo truly matches it; otherwise name whatever species it is.
${watchList}
"appearance": one or two plain sentences describing the plant in the photo (form, leaves, flowers, fruit, colours).
"photoTip": if a clearer photo of a leaf, flower or fruit would help, say so in one short sentence; otherwise null.
If the photo does not show a plant, set isPlant to false and return no candidates.`;
  const res = await call<ChatResponse>(`/openai/deployments/gpt-4o/chat/completions?api-version=${OPENAI_API}`, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: [{ type: "image_url", image_url: { url: imageDataUrl, detail: "high" } }] },
    ],
    response_format: { type: "json_schema", json_schema: visionSchema },
    temperature: 0,
    max_tokens: 500,
  });
  const parsed = JSON.parse(res.choices[0]!.message.content) as {
    isPlant: boolean;
    candidates: { scientificName: string; commonName: string; confidence: number }[];
    appearance: string;
    photoTip: string | null;
  };
  return {
    isPlant: parsed.isPlant,
    candidates: parsed.candidates.slice(0, 3).map((c) => ({ scientificName: c.scientificName, commonName: c.commonName, score: c.confidence })),
    appearance: parsed.appearance,
    photoTip: parsed.photoTip,
  };
}

/** Short first-person text from Sylvia, using only the facts it is given. */
export async function writeExplanation(facts: string): Promise<string> {
  const system = `You are Sylvia, a calm, plain-spoken guide in a Canadian wildfire-resilience app. Speak in the first person.
Using ONLY the facts provided, write 2 or 3 short sentences for a homeowner: what the plant is, why it matters here, and what to do.
Canadian spelling. Grade 8 reading level. No exclamation marks, no emoji. Never say a plant is fireproof or will not burn.
If the facts say the information is not yet reviewed, don't overstate certainty.`;
  const res = await call<ChatResponse>(`/openai/deployments/gpt-4o/chat/completions?api-version=${OPENAI_API}`, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: facts },
    ],
    temperature: 0.3,
    max_tokens: 180,
  });
  return res.choices[0]!.message.content.trim();
}

export async function embedText(text: string): Promise<number[]> {
  const res = await call<{ data: { embedding: number[] }[] }>(
    `/openai/deployments/text-embedding-3-large/embeddings?api-version=${OPENAI_API}`,
    { input: [text], dimensions: 1024 },
  );
  return res.data[0]!.embedding;
}

/** Azure AI Content Safety: true when the text is safe to show. */
export async function isSafeText(text: string): Promise<boolean> {
  const res = await call<{ categoriesAnalysis: { category: string; severity: number }[] }>(
    `/contentsafety/text:analyze?api-version=${SAFETY_API}`,
    { text },
  );
  return res.categoriesAnalysis.every((c) => c.severity < 2);
}
