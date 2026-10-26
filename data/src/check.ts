// `pnpm data:check`: validates the curation sheets and prints a summary the team can act on.
import { fileURLToPath } from "node:url";
import { loadCuration } from "./parse";

const dir = fileURLToPath(new URL("../curation", import.meta.url));
const { species, verdicts, nurseries, errors } = loadCuration(dir);

const reviewed = verdicts.filter((v) => v.review.status === "reviewed").length;
const swaps = verdicts.reduce((n, v) => n + v.swaps.length, 0);
console.log(`species ${species.length} · verdicts ${verdicts.length} (${reviewed} reviewed) · swaps ${swaps} · nurseries ${nurseries.length}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s) to fix:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("All rows are valid.");
