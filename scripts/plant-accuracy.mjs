// Plant-ID accuracy test for Sprout.
//   node scripts/plant-accuracy.mjs fetch <photo dir> [per species]   download openly licensed iNaturalist photos
//   node scripts/plant-accuracy.mjs run <photo dir> <base url>          send each photo to /api/sprout and score it
// Photos are research-grade iNaturalist observations from Canada (CC0 / CC BY / CC BY-NC), one per observer where
// possible. They stay out of the repo; the manifest keeps each photo's licence and attribution.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [cmd, dir, arg] = process.argv.slice(2);
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function csv(path) {
  const [head, ...rows] = readFileSync(join(root, path), "utf8").trim().split(/\r?\n/);
  const split = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
  const keys = split(head);
  return rows.map((r) => Object.fromEntries(split(r).map((v, i) => [keys[i], v])));
}

/** Every curated species, tested in the first region that has a verdict for it. */
function species() {
  const verdicts = csv("data/curation/region_verdicts.csv");
  return csv("data/curation/species.csv").map((s) => ({
    id: s.species_id,
    scientificName: s.scientific_name,
    commonName: s.common_name_en.split(";")[0],
    region: verdicts.find((v) => v.species_id === s.species_id)?.region_code ?? "CA-ON",
    status: verdicts.find((v) => v.species_id === s.species_id)?.status ?? "unknown",
  }));
}

const binomial = (name) => (name ?? "").toLowerCase().replace(/×\s*/g, "").split(/\s+/).slice(0, 2).join(" ");
// Accepted names that differ from VASCAN's: either answer counts as right.
const SYNONYMS = { "mahonia aquifolium": ["berberis aquifolium"] };
const sameSpecies = (a, b) => a === b || (SYNONYMS[b] ?? []).includes(a) || (SYNONYMS[a] ?? []).includes(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPhotos(out, perSpecies) {
  mkdirSync(out, { recursive: true });
  const only = process.env.ONLY;
  let manifest = [];
  try {
    if (only) manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).filter((m) => m.id !== only);
  } catch {}
  for (const s of species().filter((x) => !only || x.id === only)) {
    const taxon = s.scientificName.replace(/ subsp\. .*/, "");
    const q = new URLSearchParams({
      taxon_name: taxon, quality_grade: "research", photo_license: "cc0,cc-by,cc-by-nc", place_id: "6712",
      photos: "true", per_page: "40", order_by: "votes",
    });
    const res = await fetch(`https://api.inaturalist.org/v1/observations?${q}`, { headers: { "user-agent": "Sylvia-accuracy-test (sylvia.wildfire@gmail.com)" } });
    const { results = [] } = await res.json();
    const seen = new Set();
    let n = 0;
    for (const o of results) {
      if (n >= perSpecies) break;
      const photo = o.photos?.find((p) => p.license_code);
      if (!photo || seen.has(o.user?.login) || !sameSpecies(binomial(o.taxon?.name), binomial(taxon))) continue;
      seen.add(o.user?.login);
      const url = photo.url.replace("/square.", "/medium.");
      const img = await fetch(url);
      if (!img.ok || !(img.headers.get("content-type") ?? "").startsWith("image/jpeg")) continue;
      const file = `${s.id}-${++n}.jpg`;
      writeFileSync(join(out, file), Buffer.from(await img.arrayBuffer()));
      manifest.push({ file, ...s, observation: `https://www.inaturalist.org/observations/${o.id}`, observer: o.user?.login, license: photo.license_code });
      await sleep(300);
    }
    console.log(`${s.scientificName}: ${n} photos`);
    await sleep(1000);
  }
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`saved ${manifest.length} photos to ${out}`);
}

async function run(dirPath, base) {
  const manifest = JSON.parse(readFileSync(join(dirPath, "manifest.json"), "utf8"));
  const rows = [];
  for (const m of manifest) {
    const form = new FormData();
    form.append("image", new Blob([readFileSync(join(dirPath, m.file))], { type: "image/jpeg" }), "plant.jpg");
    form.append("region", m.region);
    const t0 = Date.now();
    let body;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${base}/api/sprout`, { method: "POST", body: form });
      body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (res.ok) break;
      await sleep(5000);
    }
    const id = body.identification ?? {};
    const names = [id.top, ...(id.alternatives ?? [])].filter(Boolean).map((c) => binomial(c.scientificName));
    const want = binomial(m.scientificName);
    const row = {
      file: m.file, expected: m.scientificName, region: m.region,
      got: id.top?.scientificName ?? (body.notPlant ? "(not a plant)" : body.error ?? "(none)"),
      top1: sameSpecies(names[0], want), top3: names.slice(0, 3).some((n) => sameSpecies(n, want)),
      confidence: id.level ?? "", askedToConfirm: !!id.needsConfirmation,
      verdictRight: body.verdict ? body.verdict.status === m.status : false,
      seconds: Math.round((Date.now() - t0) / 100) / 10,
      observation: m.observation, observer: m.observer, license: m.license,
    };
    rows.push(row);
    console.log(`${row.top1 ? "✓" : row.top3 ? "~" : "✗"} ${m.file} → ${row.got} (${row.confidence}${row.askedToConfirm ? ", asked" : ""})`);
    await sleep(1500);
  }
  const pct = (k, list = rows) => Math.round((100 * list.filter((r) => r[k]).length) / list.length);
  const high = rows.filter((r) => r.confidence === "high" && !r.askedToConfirm);
  const summary = {
    photos: rows.length, species: new Set(rows.map((r) => r.expected)).size,
    top1: pct("top1"), top3: pct("top3"), verdictRight: pct("verdictRight"),
    sureAnswers: high.length, sureAndRight: high.length ? pct("top1", high) : 0,
    askedToConfirm: pct("askedToConfirm"),
    medianSeconds: rows.map((r) => r.seconds).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
    byRegion: Object.fromEntries(["CA-ON", "CA-BC"].map((g) => [g, { photos: rows.filter((r) => r.region === g).length, top1: pct("top1", rows.filter((r) => r.region === g)) }])),
    ranAt: new Date().toISOString(), base,
  };
  writeFileSync(join(dirPath, "results.json"), JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

if (cmd === "fetch") await fetchPhotos(dir, Number(arg ?? 3));
else if (cmd === "run") await run(dir, arg ?? "http://localhost:3000");
else console.log("usage: node scripts/plant-accuracy.mjs fetch <dir> [per species] | run <dir> <base url>");
