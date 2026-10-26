// Generates src/tokens.css from tokens.json (copied from the Sylvia design system).
// `--check` fails if tokens.css is stale, so CI catches a forgotten regeneration.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tokens = JSON.parse(readFileSync(root + "tokens.json", "utf8"));
const [first, ...rest] = tokens.color.themes.map((t) => t.id);

const valueFor = (value, theme) =>
  typeof value === "string" ? value : (value[theme] ?? value[first]);

function block(theme) {
  const lines = [];
  for (const t of tokens.color.tokens) lines.push(`  --${t.name}: ${valueFor(t.value, theme)};`);
  for (const t of tokens.shadow?.tokens ?? []) lines.push(`  --${t.name}: ${valueFor(t.value, theme)};`);
  return lines.join("\n");
}

const statics = [];
for (const family of ["spacing", "radius", "size"]) {
  for (const t of tokens[family]?.tokens ?? []) statics.push(`  --${t.name}: ${t.value};`);
}
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const fam = `var(--font-${group.family})`;
    statics.push(
      `  --type-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${fam};` +
        (s.letterSpacing ? `\n  --type-${s.name}-tracking: ${s.letterSpacing};` : ""),
    );
  }
}

const dark = rest[0];
const css = `/* ${tokens.name} — generated from tokens.json by scripts/build-tokens.mjs. Do not edit. */
:root {
  color-scheme: light dark;
${block(first)}
${statics.join("\n")}
}
${dark ? `@media (prefers-color-scheme: dark) {
  :root:not([data-theme="${first}"]) {
${block(dark).replace(/^/gm, "  ")}
  }
}
:root[data-theme="${dark}"] {
${block(dark)}
}
` : ""}`;

const out = root + "src/tokens.css";
if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(out, "utf8"); } catch {}
  if (current !== css) { console.error("tokens.css is stale: run `pnpm tokens`"); process.exit(1); }
  console.log("tokens.css is up to date");
} else {
  writeFileSync(out, css);
  console.log("wrote", out);
}
