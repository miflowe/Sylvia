// Copies the Azure Maps Web SDK's prebuilt files into public/ so the map loads Microsoft's own build as a plain
// script. Bundling it breaks under Turbopack ("Identifier 'e' has already been declared" in its workers).
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("azure-maps-control/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join("public", "vendor", "azure-maps", version);
mkdirSync(out, { recursive: true });
for (const f of ["atlas.min.js", "atlas.min.css"]) cpSync(join(pkgDir, "dist", f), join(out, f));
console.log(`azure-maps-control ${version} → ${out}`);
