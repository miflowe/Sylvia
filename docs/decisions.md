# Sylvia — approved plan and locked decisions

Source of truth for product decisions. Copied from the plan approved on 2026-10-25. Change only with the user's say-so.


## Context
ECEC (TMU) is entering Microsoft Imagine Cup 2027 on the Launch path. The juniors' materials (resources folder,
Competition Proposal, HTW deliverables, old pitch site, Sylvanus design system) were inputs only. The user settled
every decision below during grilling. Deliverables:
- **Sylvia**, a working, deployed, mobile-first wildfire-resilience app
- the **Sylvia Node** hardware design, with a PCB ready to order by January
- the submission kit: deck, demo and pitch videos, validation evidence

Deadline is reported as **Jan 8, 2027** (confirm on the Imagine Cup account page). Claude builds all software,
infrastructure and the hardware design package **immediately**, with no calendar pacing. The team (**max 4
registered students**: Team Sylvia is Mina Adnan (lead), Aniket Arbatti, Salwa Mukhtar and Thirshan Varatharajah, all registered) owns interviews, data review, outreach, PCB
layout and ordering, filming and submission.

## Decisions (locked)
| Area | Decision |
|---|---|
| Goal | Imagine Cup first, startup-ready after |
| Product | Full resilience platform: Home · Map · Sprout · Alerts · Profile, plus a Communities view |
| Scope | Canada. Pilots **Ontario + BC**. Records keyed by region code (CA-ON, CA-BC) so the US can be added later. Outside the pilots: GBIF/GRIIS verdict labelled "lower confidence" |
| Hardware | Not in the January app demo. **Node PCB design (Tier B) ready by January**. All 3 tiers shown in the deck |
| Name / voice | App = **Sylvia**; Sprout = the plant-scanner tab. First-person persona in Sprout and tips; **persona off in alerts** |
| Alert authority | Level 1–2 = our advisories, "unverified" + source + time. Level 3 = **relays official orders only**. No routes, never tells people to evacuate on our own |
| Health data | One opt-in "sensitive to smoke" toggle that lowers thresholds. No diagnoses |
| Plant ID | Azure AI Foundry vision model (top 3, limited to the region's species list) + Pl@ntNet second opinion; disagreement lowers confidence and asks the user to confirm |
| Flammability | FireSmart BC / FireSmart Canada with cited sources; else "not rated"; never "fireproof" |
| Fire risk on Home | Official CWFIS fire danger + Sylvia's plain-language summary |
| Category | Health & Life Sciences |
| Platform | Mobile-first installable web app (PWA) |
| Accounts | Anonymous-first; optional Entra External ID sign-in |
| Map | Azure Maps |
| Alerts channel | Web push + in-app history; SMS on the roadmap |
| Nurseries | Azure Maps garden-centre search + curated Grow Me Instead / FireSmart badges |
| Sightings | Opt-in anonymized log → "reported nearby" layer + link to EDDMapS Ontario / Report Invasives BC |
| Demo data | Labelled **Replay mode** (archived real BC fire) |
| Data layer | Cosmos DB serverless + Azure AI Search + Blob (photos only) |
| Stack | TypeScript: Next.js PWA on Container Apps, Azure Functions, Bicep + azd, GitHub Actions |
| Repos / cloud | `miflowe/Sylvia` (public: no secrets in the repo). Azure for Students now, Bicep redeploy when the $5k credits land |
| Business model | Free for residents; "Sylvia for Communities" subscription + nursery referral fees; later insurers + Node hardware |
| MVP business proof | Read-only Communities page for one pilot town |
| Brand assets | Update the design-system artifact (Sylvia, persona rules, Level 3 = "Official order", ON + BC); retire the old pitch site |
| Pitch kit (Claude drafts) | Interview kit, ≤15-slide deck (incl. a Node tiers slide), video scripts, privacy + terms + disclaimer |
| Node radio | Wi-Fi primary + LoRaWAN backup |
| Node design split | Claude: block diagram, BOM with alternates, reference circuits, pin map, schematic-as-code → KiCad netlist, firmware, review checklists. ECE team: KiCad layout, DRC, JLCPCB order |
| Dev kit | Skipped: design straight to PCB (respin risk is handled in the PCB plan below) |

Defaults I'm assuming: English only (French on the roadmap); Canada Central (AI in Canada East if quota needs it);
photos deleted after 30 days; PurpleAir only inside the pilot bounding boxes, cached, at most every 15 min.

## Architecture (software)
```
PWA (Next.js, Container Apps) ──► API routes ──► Cosmos DB (serverless)
   │ upload (SAS) ──► Blob (30-day lifecycle)
   │ Sprout: Foundry vision (top-3, region-limited) + Pl@ntNet → region verdict (Cosmos)
   │   → native look-alikes (AI Search vector + filters) → Sylvia explanation (Azure OpenAI, grounded) → Content Safety
   │ Azure Maps Web SDK   ·   optional Entra External ID
Azure Functions: FIRMS 15m · CWFIS danger/fires/perimeters · ECCC AQHI hourly · PurpleAir 15m · Open-Meteo
   · official alerts (NAAD Alert Ready CAP + BC evacuation orders) 5m → evaluate-alerts → web push → history
   · Node telemetry (later): Azure IoT Hub (free tier) → observations, as the "Sylvia Nodes" map layer
Replay: archived event → same evaluate/push path (replay=true)   ·   Key Vault · App Insights · budget alert
```
Microsoft technologies for the deck: Azure OpenAI in Foundry (vision, text, embeddings), AI Search, AI Content
Safety, Azure Maps, Cosmos DB, Blob, Functions, Container Apps, IoT Hub, Entra External ID, Key Vault, App
Insights, GitHub Actions.

Cosmos containers (partition key):
- `species` (/speciesId)
- `regionVerdicts` (/regionCode)
- `nurseriesCurated` (/regionCode)
- `observations` (/cellId)
- `officialAlerts` (/regionCode)
- `alerts`, `pushSubscriptions`, `scans`, `checklists` (/deviceOrUserId)
- `sightings` (/cellId)
- `replayEvents` (/eventId)

AI Search index: `native-plants`, with embeddings and filters.

Repo layout:
- `apps/web`, `apps/functions`
- `packages/core` (verdict logic, alert rules, copy), `packages/ui` (components from design tokens)
- `data/` (curation templates + importers)
- `infra/` (Bicep/azd)
- `hardware/` (BOM, schematic-as-code, KiCad project, firmware, docs)
- `docs/`, `.github/workflows`

## Claude's build order (starts immediately, back-to-back, no calendar pacing)
1. **Foundation:** `PROGRESS.md`, `CLAUDE.md`, `docs/decisions.md` first (see Session-limit resilience), then monorepo scaffold, design tokens → CSS, PWA shell + 5-tab nav, CI, Bicep + azd, first deploy to Azure for Students; check Foundry model quota (if none, Pl@ntNet is primary until the credits land). Update the design-system artifact. Interview kit to the team on day 1.
2. **Data:** Cosmos schema, CSV curation templates (source column on every row), importers for Grow Me Instead, ISCBC lists, FireSmart BC lists and GBIF/GRIIS fallback; AI Search index + embeddings.
3. **Sprout:** camera/upload → Blob → vision + Pl@ntNet → verdict → look-alike swaps → Sylvia explanation → Content Safety → results UI, save, sightings opt-in, official reporting links, nursery search + badges.
4. **Wildfire data + Home:** ingestion Functions (FIRMS, CWFIS, AQHI, PurpleAir, Open-Meteo); Home dashboard with official danger, AQHI, PM2.5, hotspots, Sylvia summary, source + timestamp on everything.
5. **Map:** Azure Maps layers (hotspots, perimeters, AQHI, PurpleAir, sightings, Nodes placeholder), sensor detail cards.
6. **Alerts:** rules engine with sensitivity toggle, unverified labels, official relay, web push (VAPID), history, **Replay mode**.
7. **Profile + Communities:** saved scans, FireSmart checklist, prefs, optional sign-in; Communities page for one pilot town.
8. **Trust + polish:** privacy policy, terms, disclaimer, accessibility pass, error/offline states, full test suite, production deploy.
9. **Node design package** (in parallel with 2–8): part library (datasheets, symbols, footprints, 3D models for every part in all tiers), requirements + block diagram, Tier A/B/C BOMs, Tier B reference circuits + power budget, schematic-as-code → KiCad netlist, firmware (ESP-IDF: sensors → Wi-Fi/MQTT to IoT Hub, LoRaWAN fallback, deep sleep), layout constraints + DRC/review checklists for the team.
10. **Pitch kit:** deck (architecture, Microsoft tech list, Node tiers slide, business model), demo + pitch scripts, validation findings template.

After that, Claude's work tracks the team's: fixes from interviews, bug bashes and PCB review feedback.

## Sylvia Node hardware
Purpose: home-level early smoke and smoulder detection plus hyperlocal air quality. The **CO/CO2 ratio**
(electrochemical CO + SEN66 CO2) helps separate a smouldering wildfire from a bonfire or barbecue, which is the gap
the API research flagged (PurpleAir measures PM only).

Prices are USD, quantity 1, from distributor snapshots (DigiKey, LCSC, RAK, Winsen); **verify at order**.

| Function | Tier A: Budget Wi-Fi (~$45–70) | **Tier B: Resilient home (~$110–170), building this** | Tier C: Off-grid rural (~$200–300) |
|---|---|---|---|
| MCU / Wi-Fi | ESP32-C6-WROOM-1 (~$4) | ESP32-S3-WROOM-1-N8R8 (~$5) | ESP32-S3 (~$5) + cellular below |
| Backup radio | — | RAK3172 LoRaWAN, US915 (~$6–8) + u.FL antenna (~$4) | nRF9151 LTE-M/NB-IoT SiP (~$25) or SIMCom SIM7080G (~$12–18) + SIM (~$3–10/mo) + RAK3172 |
| Particulates | Plantower PMSA003I (~$15–25) | **Sensirion SEN66** (~$59: PM1–10, CO2, VOC, NOx, RH/T) | Sensirion SPS30 (~$24–37, 8-yr life) |
| CO2 | — | in SEN66 | Sensirion SCD41 (~$15–20) |
| CO (electrochemical) | Winsen ZE07-CO module, optional (~$20) | SPEC Sensors 110-102 (~$25) + TI LMP91000 front end (~$4) | SPEC 110-102 + LMP91000 (or Alphasense CO-B4, quote needed) |
| Smoulder / H2 / VOC | Bosch BME688 (~$9) | Bosch BME688 (~$9) | BME688 + Sensirion SGP41 (~$6) |
| Temp / RH | in BME688 | in SEN66 + BME688 | Sensirion SHT45 (~$5.5) |
| Heat | — | — | Melexis MLX90614 IR (~$12) |
| Power | USB-C 5 V wall adapter | 6 V 2 W solar (~$15–25) + LiFePO4 18650 (~$6) + solar charger IC (CN3791 or TI BQ24650, ~$2–4) + fuel gauge (MAX17048, ~$3) | 5 W solar + 2× LiFePO4 or supercapacitor bank (~$40–60) |
| Enclosure | Vented IP65 ABS box (~$10) | IP65 box + radiation shield / louvres, PM inlet/outlet path (~$20–35) | UV-stable ASA or die-cast + shield (~$40–60) |
| PCB | 2-layer | **4-layer** (solid ground for RF), ~60×80 mm | 4-layer |
| Weakness | Dies with home Wi-Fi/power | Rural LoRaWAN coverage is sparse: pilots may need a gateway (RAK7268, ~$150–250) | SIM costs, higher power draw |

Additional Tier B board parts:
- USB-C (programming/charging)
- ESD protection
- 3.3 V buck-boost (TPS63020-class)
- load switches to power-gate the SEN66 and CO front end
- status LED + buzzer pads
- tamper/test pads, SWD/UART header
- footprints for **alternates**: a PMSA003I footprint as the SEN66 fallback, and a ZE07-CO pads option

**PCB plan without a dev kit (respin risk control):**
- schematic-as-code reviewed against each datasheet's reference design
- test points on every rail and bus
- 0 Ω jumpers to isolate subsystems
- I2C pull-up and address map documented
- JLCPCB 4-layer, 5–10 boards with assembly (setup ~$8 + parts; bare 4-layer from ~$7 promo)
- **gerbers + BOM/CPL ready by early January**, ordered before Chinese New Year (Feb 6, 2027) factory closures

Firmware: ESP-IDF, with these behaviours:
- wake every 60 s, read SEN66/BME688/CO
- local spike detection (PM slope + CO/CO2 ratio)
- publish over Wi-Fi via MQTT to Azure IoT Hub; fall back to LoRaWAN uplink (compact payload)
- OTA updates
- device provisioning with per-device keys (never committed to the public repo)

### Part library: datasheets, symbols, footprints, 3D models (every part, all 3 tiers)
Every BOM line (Tier A, B and C, plus alternates and passives families) gets four things, tracked in
`hardware/parts/parts.csv` (MPN, LCSC #, DigiKey #, tier, datasheet URL + sha256, symbol/footprint/3D status, source,
licence):
- **Datasheet PDF:** from the manufacturer's site (Sensirion, Bosch, Espressif, RAK, SPEC, TI, Winsen, Nordic,
  SIMCom, Melexis, Plantower), saved to `hardware/datasheets/<MPN>.pdf`.
- **Symbol + footprint + 3D model (.step/.wrl):** source in this order:
  1. KiCad 9 official libraries (e.g. ESP32-S3-WROOM-1)
  2. `easyeda2kicad` by LCSC part number (no account needed)
  3. Manufacturer CAD downloads
  4. SnapEDA / Ultra Librarian (these need an account, so the **user downloads**, and Claude lists exactly which parts)

  Everything goes into project libraries `hardware/kicad/lib/sylvia.kicad_sym`, `sylvia.pretty/`, `3dmodels/`.
- **Verification:** every footprint is checked against its datasheet's land pattern and pin-1 location. Parts that
  have no 3D model get a simple box model, marked "placeholder".
- **Downloads need your OK.** Before downloading, Claude shows the full list (file, source, approximate size) for
  one-time approval per batch. Downloads go to a fresh folder and are inspected before being moved into `hardware/`.
- **Public-repo caveat:** manufacturer datasheets are usually copyrighted, so PDFs are **gitignored** and kept
  locally / in the club drive. The repo commits `parts.csv` with URLs + checksums so anyone can re-fetch them.
  KiCad library files are committed.

## Session-limit resilience (5-hour usage windows)
Execution assumes a session can stop at any moment and resume hours later in a fresh context:
- **`PROGRESS.md` in the repo** is the single source of truth: build-order checklist, the current step, the exact
  **next action**, blockers, and what's waiting on the user/team. Updated after every sub-step, not at the end.
- **Small, finishable chunks** (~30–45 min each). Never leave a file half-edited; finish the chunk, run its tests,
  **commit + push**, update PROGRESS.md, then start the next.
- **`CLAUDE.md` + `docs/decisions.md` in the repo** hold the locked decisions and conventions from this plan.
  Project memory points to them, so a new session needs nothing from chat history.
- **Resume ritual** (when you say "continue"): read PROGRESS.md → `git log` → run tests → carry on from "next action".
  Never redo finished steps, never guess.
- Long commands run in the background with logs written to `logs/`. Infra deploys are idempotent (Bicep/azd), so a
  deploy cut off mid-way is safely re-run.
- Optional: a scheduled reminder that pings this session after the window resets, to continue from PROGRESS.md
  (only if you want it).

## Materials to source (the team registers; Claude can't create accounts)
- **Keys:** NASA FIRMS MAP_KEY · PurpleAir API key · Pl@ntNet API key
- **Open data:**
  - CWFIS (credit NRCan)
  - ECCC MSC GeoMet AQHI
  - Open-Meteo (confirm terms)
  - NAAD Alert Ready CAP feed
  - BC evacuation orders
  - GBIF / GRIIS Canada
- **Curated pilot data (team reviews):** Grow Me Instead (OIPC) · ISCBC invasive lists · FireSmart BC plant lists · native-plant traits
- **Replay event:** FIRMS archive + CWFIS + AQHI history for one real BC fire (summer 2026)
- **Tools on this PC (user installs and signs in):** Azure CLI, azd, GitHub CLI; KiCad 9 for the ECE team
- **Hardware purchase (Tier B, after design review):** 5–10 assembled PCBs + sensors not placed by JLCPCB (SEN66, SPEC CO, RAK3172 if hand-soldered), solar panels, cells, enclosures. Budget ~$800–1,400 for 5 nodes. The SEN66 had a 16–17 week factory lead time and was out of stock at DigiKey Canada: order early (DigiKey US/Mouser)

## Team schedule (unchanged, hardware rows added; deadline Jan 8)
| Week | Team does |
|---|---|
| Oct 26–Nov 1 | Install/sign in to tools, register API keys, all 4 register on Imagine Cup, **start interviews** |
| Nov 2–8 | Review ON + BC plant data; ECE: review Node requirements + block diagram |
| Nov 9–15 | Interviews; nursery list for badges; ECE: review BOM, order long-lead parts (SEN66) |
| Nov 16–22 | Interviews; contact a pilot town; ECE: schematic review |
| Nov 23–29 | Usability test round 1; ECE: start KiCad layout |
| Nov 30–Dec 6 | Interview synthesis; ECE: layout |
| Dec 7–13 | Usability test round 2; ECE: layout review + DRC |
| Dec 14–20 | Exams |
| Dec 21–27 | Review deck and scripts; ECE: final layout fixes |
| Dec 28–Jan 3 | Bug bash, rehearse; ECE: gerbers/BOM/CPL final, place JLCPCB order |
| Jan 4–7 | Film demo (2 min) + pitch (3 min), host publicly, submit by **Jan 7** |

## Verification
- Unit tests (Vitest): verdict + "not rated" logic, alert thresholds with sensitivity, persona-off-in-alerts copy
- Playwright at phone size: onboarding → Home → Map → Sprout (fixture photos) → swaps → save; replay asserts a Level 2 advisory fires and pushes
- Real-device install + push test on iPhone (16.4+) and Android; Lighthouse PWA/accessibility ≥ 90; axe clean; 4.5:1 contrast
- `azd provision --preview` before infra changes; post-deploy smoke test in CI; budget alert
- Plant-ID accuracy on 50 labelled ON/BC photos (top-1 and top-3) for the deck
- Hardware: ERC on the schematic netlist, DRC in KiCad, datasheet cross-check checklist, power budget showing ≥7 days without sun on Tier B, firmware tested against simulated sensor readings, IoT Hub ingestion test with a simulated device
