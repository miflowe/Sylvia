// Renders the Signal Leaf app icon (public/icon.svg, from the Sylvia design system) to the PNG sizes phones need.
// Run after changing the icon: node scripts/make-icons.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next/package.json")] }));
const svg = readFileSync("public/icon.svg");
for (const [file, size] of [["public/icon-192.png", 192], ["public/icon-512.png", 512], ["src/app/apple-icon.png", 180]]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
