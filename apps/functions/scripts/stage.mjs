// Stages a self-contained deploy/ folder: bundled functions (deps included) + host.json + a dependency-free
// package.json. azd zips only deploy/, so pnpm's linked node_modules never reach the package.
import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const out = "deploy";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const entries = readdirSync("src/functions").filter((f) => f.endsWith(".ts")).map((f) => `src/functions/${f}`);
await build({
  entryPoints: entries,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: `${out}/dist/functions`,
  alias: { "@sylvia/core": "../../packages/core/src/index.ts" },
  external: ["@azure/functions-core"], // provided by the Functions host at runtime
  // Some CommonJS deps call require(); give ESM bundles a working one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

cpSync("host.json", `${out}/host.json`);
writeFileSync(
  `${out}/package.json`,
  JSON.stringify({ name: "sylvia-functions", type: "module", main: "dist/functions/*.js" }, null, 2) + "\n",
);
console.log(`staged ${entries.length} function file(s) in ${out}/`);
