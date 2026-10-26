import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCuration } from "./parse";
import { searchDocFor, embeddingText } from "./search";

const curation = fileURLToPath(new URL("../curation", import.meta.url));
const files = ["species.csv", "region_verdicts.csv", "swaps.csv", "nurseries.csv"];

function copyWith(edit: (file: string, text: string) => string) {
  const dir = mkdtempSync(join(tmpdir(), "sylvia-cur-"));
  for (const f of files) writeFileSync(join(dir, f), edit(f, readFileSync(join(curation, f), "utf8")));
  return dir;
}

describe("curation sheets", () => {
  it("the committed sheets are valid", () => {
    const c = loadCuration(curation);
    expect(c.errors).toEqual([]);
    expect(c.species.length).toBeGreaterThan(10);
    expect(c.verdicts.find((v) => v.id === "CA-ON:berberis-thunbergii")?.swaps[0]?.speciesId).toBe("physocarpus-opulifolius");
  });

  it("reports a fireproof claim with its row number", () => {
    const dir = copyWith((f, t) => (f === "swaps.csv" ? t.replace("Burgundy-leaved ninebark", "Fireproof ninebark") : t));
    expect(loadCuration(dir).errors.join("\n")).toMatch(/swaps\.csv row 2: .*fireproof/i);
  });

  it("rejects a swap to a plant that isn't native in that region", () => {
    const dir = copyWith((f, t) =>
      f === "swaps.csv" ? t + "CA-ON,berberis-thunbergii,mahonia-aquifolium,Yellow flowers in spring.,Test,,draft\n" : t,
    );
    expect(loadCuration(dir).errors.join("\n")).toMatch(/mahonia-aquifolium needs a native verdict in CA-ON/);
  });
});

describe("search documents", () => {
  it("builds one look-alike document per native verdict", () => {
    const c = loadCuration(curation);
    const species = new Map(c.species.map((s) => [s.id, s]));
    const natives = c.verdicts.filter((v) => v.status === "native");
    const doc = searchDocFor(natives[0]!, species.get(natives[0]!.speciesId)!);
    expect(doc.id).not.toContain(":");
    expect(embeddingText(species.get("physocarpus-opulifolius")!)).toContain("burgundy");
  });
});
