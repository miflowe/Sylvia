# Sylvia — build progress

Single source of truth for where the build is. Updated after every chunk.

**Current step:** 5 Map
**Next action:** Step 5: Azure Maps map with layers (hotspots, fire perimeters from `observations.shape`, AQHI stations, PurpleAir, sightings, Nodes placeholder) and sensor detail cards. Needs a Maps key for the browser: use an Entra/SAS token route or a domain-restricted key.

## Build order
- [x] 1 Foundation
  - [x] Repo initialized, remote `miflowe/Sylvia`, resume docs (`CLAUDE.md`, `PROGRESS.md`, `docs/decisions.md`)
  - [x] Monorepo scaffold (pnpm workspaces, TypeScript, Vitest, ESLint)
  - [x] Design tokens → CSS variables (`packages/ui`); run `pnpm tokens` after editing `packages/ui/tokens.json`
  - [x] PWA shell + 5-tab nav (Home, Map, Sprout, Alerts, Profile). `public/icon.svg` is a placeholder until the design system has Sylvia app icons
  - [x] CI (GitHub Actions: lint, test, build)
  - [x] Bicep + azd skeleton (`infra/`, `azure.yaml`, `apps/web/Dockerfile`). NOT yet validated: needs `az bicep build` + `azd provision --preview`
  - [x] Interview kit for the team (`docs/kits/interview-kit.md`)
  - [x] First deploy (env `sylvia-dev`). Web: https://ca-web-6x6suo5lxjc5o.icysmoke-e61b83ec.canadacentral.azurecontainerapps.io · Functions: https://func-6x6suo5lxjc5o.azurewebsites.net/api/health
  - [x] Foundry: `ai-6x6suo5lxjc5o` in Sweden Central (user approved), deployments `gpt-4o` (Standard, 45K TPM; identification + explanations) and `text-embedding-3-large`. gpt-4o-mini can't be deployed (deprecated). **gpt-4o retires 2027-04-14: swap before spring rounds.**
- [x] 2 Data
  - [x] Schemas in `packages/core/src/plants.ts` (Species, RegionVerdict with swaps, Nursery) + VASCAN fallback (`gbif.ts`)
  - [x] Curation sheets `data/curation/*.csv` + team guide `data/curation/README.md`. 16 species, 17 verdicts, 9 swaps, ALL DRAFT (team must verify against sources)
  - [x] `pnpm data:check` (validate) · `pnpm data:import` (Cosmos + embeddings + `native-plants` index; keys come from az CLI at run time)
  - [x] 11 Cosmos containers + AI Search free tier (`srch-6x6suo5lxjc5o`, Canada Central) provisioned; first import done
- [x] 3 Sprout
  - [x] Pipeline (`apps/web/src/server/sprout.ts`): gpt-4o vision (region watch list) + Pl@ntNet in parallel → `mergeIdentifications` (noise floor 0.1) → curated verdict or VASCAN fallback → curated swaps + AI Search look-alikes → Sylvia explanation (gpt-4o) → Content Safety. `/api/sprout` (photo) and `/api/sprout/assess` (picked alternative)
  - [x] Screens (`apps/web/src/app/sprout/`): region picker, camera/upload (canvas re-encode strips EXIF/GPS), confidence chip, "is it one of these?", verdict, Sylvia says, swaps, official report link
  - [x] Tested with `apps/web/test-fixtures/` (barberry, Scotch broom, ninebark, not-a-plant): all correct locally and live
  - [x] Saved scans: `/api/scans` (+ `[id]`, `[id]/photo`), photos in private Blob `photos/{device}/{scan}.jpg` (30-day lifecycle), anonymous device id header `x-sylvia-device` (`apps/web/src/lib/device.ts`); My plants on Profile
  - [x] Opt-in sightings: `/api/sightings`, curated invasive only, ~1 km rounding, no device link, cellId partition
  - [x] Garden centres: `/api/nurseries` → Azure Maps POI category 9361032 + curated badges (`matchCurated`). Azure Maps data is noisy (e.g. arborists, a lighting shop); curated nurseries fix this once the team fills `nurseries.csv`
- [x] 4 Wildfire data + Home
  - [x] Ingestion Functions (`apps/functions/src/functions/ingest.ts`, parsers in `src/lib/feeds.ts` with tests): FIRMS VIIRS ×3 (15 min), CWFIS `m3_polygons_current` perimeters (hourly), ECCC AQHI latest (hourly), PurpleAir pilot areas (15 min). Manual run: POST `/api/ingest?feed=` with the function key
  - [x] `observations` container: per-item TTL + spatial index on `/location`
  - [x] Pilot areas (user choice): Northwestern Ontario + Kamloops–Okanagan (`PILOT_AREAS` in `packages/core/src/observations.ts`)
  - [x] `/api/conditions`: CWFIS fire danger point query (GRIDCODE 0 = Low … 4 = Extreme, verified from legend), nearest AQHI ≤120 km, PurpleAir median ≤10 km, hotspots ≤50 km/24 h, perimeters ≤100 km, Open-Meteo weather, Sylvia summary (gpt-4o + Content Safety)
  - [x] `/api/places` (Azure Maps search + reverse) and the Home dashboard with place picker and "sensitive to smoke" toggle (device only)
- [ ] 5 Map
- [ ] 6 Alerts + Replay mode
- [ ] 7 Profile + Communities
- [ ] 8 Trust + polish (privacy, terms, disclaimer, a11y, tests, prod deploy)
- [ ] 9 Node design package (proposed as its own session: `hardware/PROGRESS-hardware.md`)
- [ ] 10 Pitch kit (deck, video scripts, findings template)

## Waiting on the user / team
- PurpleAir: the key in `.env.local` is a WRITE key. Put the READ key in `PURPLEAIR_API_KEY` (local file), then run `azd env set PURPLEAIR_API_KEY <read key>` and `azd provision`.
- Fill `data/curation/nurseries.csv` with Grow Me Instead / FireSmart BC retailers: the Azure Maps garden-centre results alone are unreliable.
- Verify the draft plant rows in `data/curation/` against their sources (see its README), then run `pnpm data:check`.
- Optional: `gh auth login` (GitHub CLI isn't signed in; git push works without it).
- Register API keys: NASA FIRMS MAP_KEY, PurpleAir, Pl@ntNet. Put them in `apps/web/.env.local` (never commit).
- All 4 team members register on the Imagine Cup site; fix "five people" anywhere it appears.
- Start customer interviews with the shareable kit: https://claude.ai/artifact/VPfkfLMLKUS7j8MfftnAB7 (source `docs/kits/interview-kit.html`; share it from the page's Share menu).

## Azure for Students quirks (learned the hard way)
- Allowed regions only: canadacentral, westus2, swedencentral, norwayeast, mexicocentral.
- No Cosmos capacity in Canada Central → Cosmos is in **westus2** (user approved). Account names are per region.
- ACR remote builds blocked → web image built by `.github/workflows/web-image.yml` to `ghcr.io/miflowe/sylvia-web` (public). Deploy with `scripts/deploy-web.sh [sha]` (sets `WEB_IMAGE`, runs `azd provision`).
- Container Apps env is "express": no managed identity, and `az containerapp update` fails. Use `azd provision`.
- Functions deploy from the staged `apps/functions/deploy/` folder (pnpm symlinks can't be zipped).

## Log
- 2026-10-25: Plan approved. Repo initialized.
- 2026-10-26: Azure tools signed in. Deploy fixes (Maps region, remote build, staged Functions folder). Note: commit 0e5f187 accidentally included the hardware session's in-progress `hardware/` files (no secrets or PDFs).
- 2026-10-26: First Azure deploy live (web + Functions + Cosmos + Foundry). Interview kit published as a shareable page.
- 2026-10-26: Step 4 live: feeds ingesting on timers (533 hotspots, 394 perimeters, 75 AQHI stations at first run); Home dashboard deployed.
- 2026-10-26: Step 3 complete and live (saved scans, sightings, garden centres).
- 2026-10-26: Step 3 core live: Sprout identifies, judges and suggests swaps on Azure. Local dev: `node scripts/dev-env.mjs` fills `apps/web/.env.local`; Pl@ntNet key also in azd env.
- 2026-10-26: Step 2 done. First import: barberry look-alikes in CA-ON = black chokeberry, common ninebark, kinnikinnick.
