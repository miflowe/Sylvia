# Sylvia — build progress

Single source of truth for where the build is. Updated after every chunk.

**Current step:** All Claude build steps done; waiting on team inputs
**Next action (Claude):** refresh the deck for replay, smoke forecast, Ask Sylvia, laptop layout, the intro, named fires and resident reports; note the EPA-corrected PurpleAir values. **Team:** fill the deck's [placeholders] from interview findings (slide 8 validation, slide 10 prices, cover/roadmap team names, slide 9 video links), then film with `docs/kits/video-scripts.md`. Open items: sign-in (waits on the $5k-credit tenant), iPhone push test.

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
- [x] 5 Map
  - [x] `/api/map?bbox&zoom` (Cosmos `ST_WITHIN`; fire outlines only at zoom ≥ 6) and `/api/map/key`
  - [x] Map screen (`apps/web/src/app/map/`): layer chips with counts, home marker, detail cards for fire areas, satellite heat, AQHI, smoke sensors, sightings; "Sylvia Nodes · coming soon" placeholder
  - [x] Azure Maps SDK 3.7.4 served from `public/vendor` (copied by `apps/web/scripts/copy-atlas.mjs` in dev/build): bundling it breaks under Turbopack
  - [x] Maps account CORS: only the web app's origin + localhost (`webOrigin` param from azd `WEB_URL`). A SAS-token approach needs a role assignment, which the user hasn't approved
- [x] 6 Alerts + Replay
  - [x] Rules (`packages/core/src/rules.ts`, 12 tests): L1 heat ≤25 km/12 h, L2 ≥2 detections ≤10 km/6 h ("be ready to leave if officials tell you to"), smoke via AQHI/PM2.5 with lower thresholds when sensitive; official BC/Alert Ready **alerts → Level 2 Official**, **orders → Level 3**, naming the agency; an official order suppresses Sylvia's own hotspot warning
  - [x] Official relay (`apps/functions/src/lib/officials.ts`): BC Evacuation Orders and Alerts FeatureServer + Alert Ready (NAAD) Atom feed → `officialAlerts`, every 5 min; home matching by point-in-polygon
  - [x] Per-home evaluation + web push (`apps/functions/src/lib/alerting.ts`): every 15 min and after each official ingest, 12 h dedupe by key, expired subscriptions removed. VAPID keys in `.env.local` + azd env (never in git)
  - [x] Alerts tab: turn on/off (home area stored rounded ~1 km; deleted when turned off), test notification, level guide, history (`AlertBanner` uses the reserved alert colours + level number + word + icon)
  - [x] Replay: Quilpituk Creek wildfire (Aug 2026) from archived FIRMS VIIRS + BC historical orders (K51402). Inputs in `data/replay/quilpituk-creek-2026/`, rebuild with `pnpm data:replay`. 6 frames → L1 heat (21 km N) → L2 official alert → L3 official order. BC publishes order dates only; frames say so
  - [x] Real-device push test on Android (2026-10-27): test notification + 3 replay notifications delivered via FCM
  - [ ] Real-device push test on an installed iPhone (iOS 16.4+)
- [x] 7 Profile + Communities (sign-in code built; live sign-in waits on a tenant)
  - [x] FireSmart checklist on Profile (`packages/core/src/firesmart.ts`, 15 items in 5 zones, paraphrased from FireSmart Canada); `/api/checklist` stores only ticks + percent + community tag (no coordinates)
  - [x] Central Okanagan community view `/communities/central-okanagan` (`apps/web/src/server/community.ts`): right-now conditions + official notices, homes with alerts on, checklist adoption, invasive sightings; counts under 5 hidden; labelled **sample data** switch for town interviews (`SAMPLE_COMMUNITY`)
  - [x] Optional sign-in code (Entra External ID, MSAL redirect + PKCE, `jose` token verification): `ownerId()` = account (`u-<oid>`) when signed in, else device; `/api/auth/link` moves device data on first sign-in; `/api/auth/account` DELETE removes everything. Hidden until AUTH_* env vars are set
  - [ ] Sign-in live test. BLOCKED: the TMU directory (Azure for Students tenant 360b39cf…) sets allowedToCreateTenants=false and allowedToCreateApps=false, so students can't create an External ID tenant or an app registration there. Options: wait for the $5k-credit subscription (likely in a tenant you control), the External ID 30-day trial with a personal Microsoft account, or ask TMU IT
- [x] 8 Trust + polish
  - [x] `/privacy` and `/terms` (safety notice, data-source credits); disclaimer on Home and onboarding; links on Profile. Contact email slot in `packages/core/src/site.ts` (empty until the team inbox exists)
  - [x] Signal Leaf app icon from the design system (`public/icon.svg`, PNGs via `apps/web/scripts/make-icons.mjs`, maskable + Apple touch); offline page served by the service worker (pages only; data is never cached)
  - [x] Accessibility: `apps/web/e2e/a11y.spec.ts`, axe WCAG 2.1 A/AA on 8 screens × light/dark = 16 checks, 0 violations (map canvas excluded)
  - [x] End-to-end: `apps/web/e2e/flows.spec.ts`, 7 flows at Pixel 7 size, all passing against real Azure. Run with `pnpm --filter web e2e` (dev server on :3000 or `E2E_BASE_URL`)
  - [x] Lighthouse (live, mobile, after redesign, median of 3): Home 86, Sprout 91, Alerts 78, Profile 94, Map 62, Privacy 97 performance; accessibility, best practices and SEO 100 everywhere except Map SEO 90 (Azure Maps attribution links). Performance swings with load on this PC: stop the dev server first. Details `docs/results/lighthouse.md`. Lighthouse can't spawn Chrome here; start Chromium via Playwright with `--remote-debugging-port=9222` and pass `--port=9222`
- [x] 9 Node design package (built in its own session, committed 5f94b49; status in `hardware/PROGRESS-hardware.md`)
- [x] 10 Pitch kit
  - [x] Deck (15 slides, Sylvia design system, live-app screenshots): https://claude.ai/artifact/QE4dyNRhjT4gMhhc4VTuGQ. Bracketed placeholders: team names, interview count/quotes/results (slide 8), prices (slide 10), demo/app links (slide 9). Private until shared from its Share menu; downloads as PPTX/PDF
  - [x] `docs/kits/video-scripts.md`: 2:00 demo shot list + 3:00 pitch script, one take each (no editing allowed)
  - [x] `docs/kits/findings-template.csv` for interview logging (also on the shareable interview kit page)

## Waiting on the user / team
- PurpleAir READ key: updated by the user 2026-10-28, copied to the azd env and provisioned; 125 Kamloops–Okanagan sensors live.
- Fill `data/curation/nurseries.csv` with Grow Me Instead / FireSmart BC retailers: the Azure Maps garden-centre results alone are unreliable.
- Verify the draft plant rows in `data/curation/` against their sources (see its README), then run `pnpm data:check`.
- Optional: `gh auth login` (GitHub CLI isn't signed in; git push works without it).
- Register API keys: NASA FIRMS MAP_KEY, PurpleAir, Pl@ntNet. Put them in `apps/web/.env.local` (never commit).
- Done 2026-10-28: all 4 registered as Team Sylvia (Mina Adnan, lead; Aniket Arbatti; Salwa Mukhtar; Thirshan Varatharajah). Deck cover, last slide and pitch script carry the names.
- Start customer interviews with the shareable kit: https://claude.ai/artifact/VPfkfLMLKUS7j8MfftnAB7 (source `docs/kits/interview-kit.html`; share it from the page's Share menu).

## Azure for Students quirks (learned the hard way)
- Allowed regions only: canadacentral, westus2, swedencentral, norwayeast, mexicocentral.
- No Cosmos capacity in Canada Central → Cosmos is in **westus2** (user approved). Account names are per region.
- ACR remote builds blocked → web image built by `.github/workflows/web-image.yml` to `ghcr.io/miflowe/sylvia-web` (public). Deploy with `scripts/deploy-web.sh [sha]` (sets `WEB_IMAGE`, runs `azd provision`).
- Container Apps env is "express": no managed identity, and `az containerapp update` fails. Use `azd provision`.
- Functions deploy from the staged `apps/functions/deploy/` folder (pnpm symlinks can't be zipped).

## Log
- 2026-10-28: Team Sylvia names on the deck and pitch script. Plant-ID accuracy test (`scripts/plant-accuracy.mjs`, 48 licensed iNaturalist photos, 16 species): 83% top-1, 94% top-3, 29/30 right when "sure"; Norway maple is the weak spot (`docs/results/plant-id-accuracy.md`). Sylvia Node cloud path live: IoT Hub `iot-6x6suo5lxjc5o` (F1, enrichments `loc` + `name` from twin tags), `nodeTelemetry` Function, "Sylvia Nodes" map layer; `scripts/node-sim.mjs` reading reached the map in ~14 s (`docs/results/node-cloud-test.md`). Simulated devices are named `sylvia-sim-*`.
- 2026-10-29: UN SDG targets 3.9, 11.5, 13.1, 15.8 added: a badge row on the roadmap slide (deck v18), one line in the pitch script's close plus a judge Q&A note, and an `SDG target` column in the findings sheet / interview kit (v2) so each target gets a real finding behind it.
- 2026-10-29: Map taps fixed for phones: one tap handler picks the nearest point within 22 px (a 44 px finger target) instead of needing an exact hit on 8 px dots; a ring marks the selected point; tapping empty map closes the card; zoom/compass controls no longer draw over the card.
- 2026-10-29: Map: sensor groups that split on zoom, satellite heat shaded by age with a 1–24 h slider, "Replay a real past fire" on the map (heat, estimated area and alerts play hour by hour, `replayTimeline.ts` in core), FireWork smoke forecast layer with a 3–48 h slider. Home: smoke forecast line + 2-day chart (GeoMet `RAQDPS.Sfc_PM2.5-WildfireSmokePlume`), Ask Sylvia (GPT-4o grounded in live readings; route/evacuate/emergency questions get fixed replies; Content Safety + Prompt Shields on questions, rule check + Content Safety on answers; 8 per 10 min). Profile: Appearance System/Light/Dark. Deployed image 7f7cf56; 25/25 e2e.
- 2026-10-29: Tablet/laptop layouts live (image 5bb95f2): side rail from 768 px (labelled from 1100 px), two-column Home, map side panel, centred sheets; phones unchanged; map circle numbers centred; tablet+laptop axe checks added. Found: PurpleAir values are shown uncorrected (no US EPA wildfire-smoke correction yet); official evacuation areas feed alerts but aren't drawn on the map.
- 2026-10-29: First-launch intro live (image f9fa0c2): slow handwritten "hello" (Dancing Script, pen-style mask reveal), mixed leaves at 1.4× pace fall to full cover, gust sweep with wind lines reveals the app; once only (`sylvia.welcomed` + <head> class), Skip always, reduced motion fades. Tests seed `sylvia.welcomed`; `e2e/intro.spec.ts` covers the intro. 39/39 e2e.
- 2026-10-30: Map sources: PurpleAir US EPA corrected (A/B channel check; ~85% of pilot sensors pass); BC Wildfire Service + Ontario MNR named fires with official status (`ingestNamedFires`, every 30 min); heat linked to the nearest named fire (`matchHeatToFire`); official evacuation areas drawn from `officialAlerts`; CWFIS Fire Weather Index tiles. Resident reports: `reports` container (TTL 6 h), photos under `photos/reports/` (1-day rule), Content Safety text+image, 3/h and 8/day per device hash, map layer + report sheet with 911/*5555/310-FIRE first, unverified Level 1 note only when 3+ people within 2 km in an hour and nothing else covers it (core `reports.ts`, functions `alerting.ts`). Fixed: head script (theme before paint), stale map responses. Intro leaves now sprite-based: laptop 59 fps vs 46 before on Iris Xe (production build).
- 2026-10-25: Plan approved. Repo initialized.
- 2026-10-26: Azure tools signed in. Deploy fixes (Maps region, remote build, staged Functions folder). Note: commit 0e5f187 accidentally included the hardware session's in-progress `hardware/` files (no secrets or PDFs).
- 2026-10-26: First Azure deploy live (web + Functions + Cosmos + Foundry). Interview kit published as a shareable page.
- 2026-10-27: Team email live on /privacy. Step 10 pitch kit done (deck + scripts + findings template).
- 2026-10-27: App redesign so it feels like a native phone app (user approved mockup): screen headers, pill tab bar, fire-danger hero card, tappable tiles with detail sheets, switches and grouped lists, scan card with recent plants, full-screen map with floating chips. Shared pieces in `apps/web/src/components` (Icon, ScreenHeader, Sheet, ScanThumb) and `globals.css` (list, switch, segmented, btn).
- 2026-10-27: UI refresh (user picked "friendly rounded"): one typeface, Figtree, for everything; no monospace or uppercase labels; borderless soft cards; rounder corners. Deck (new screenshots too) and design-system artifact (https://claude.ai/artifact/Bm1Qwr6TgwKDJJWaPCENnx) now match. The design system's logo and starter SVGs still use the old serif and the "Sylvanus" name: redraw before public use.
- 2026-10-27: Step 8 done and deployed: legal pages, icons, offline, a11y 0 violations, 7 e2e flows, Lighthouse ≥97.
- 2026-10-27: Step 7 deployed (checklist, Communities, sign-in code switched off until configured).
- 2026-10-27: Step 6 live: official relay + alert evaluation timers, web push, Alerts tab, Replay (verified live via API).
- 2026-10-27: Step 5 live: map with all layers and detail cards.
- 2026-10-26: Step 4 live: feeds ingesting on timers (533 hotspots, 394 perimeters, 75 AQHI stations at first run); Home dashboard deployed.
- 2026-10-26: Step 3 complete and live (saved scans, sightings, garden centres).
- 2026-10-26: Step 3 core live: Sprout identifies, judges and suggests swaps on Azure. Local dev: `node scripts/dev-env.mjs` fills `apps/web/.env.local`; Pl@ntNet key also in azd env.
- 2026-10-26: Step 2 done. First import: barberry look-alikes in CA-ON = black chokeberry, common ninebark, kinnikinnick.
