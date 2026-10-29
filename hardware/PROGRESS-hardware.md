# Sylvia Node: hardware progress

Single source of truth for the Node design package (plan step 9). Updated after every chunk.
Resume: read this file, run `hardware/.venv/Scripts/python -I hardware/tools/verify_all.py`, continue from **Next action**.

**Current step:** H9 done: design package complete, handed to the ECE team for review + layout.
**Next action (Claude):** fixes from the ECE schematic review. Firmware still needs a real `idf.py build` on a PC
with ESP-IDF (the user declined installing it here, 2026-10-26).

## Checklist
- [x] H1 `parts/parts.csv`: 75 rows, all tiers, alternates, key passives; JLCPCB price/stock snapshot (`tools/build_parts.py`)
- [x] H2 Download batches: 1 (2026-10-25), 2 + TPS2121 items (2026-10-26) approved and done
- [x] H3 Part library
  - 50 datasheets (`parts/datasheets.csv` = URL + sha256; PDFs gitignored). Missing: nRF9151 PS (user, browser), SWPA6045 (generic)
  - `kicad/lib`: 66 symbols, 60 footprints, 3D models (~10 MB committed; EasyEDA + Sensirion STEP gitignored)
  - EasyEDA 3D models placed by fitting their pads onto KiCad's pads (USB-C, BQ24650, WROOM-1U, SCD4x, SHT4x, RAK3172,
    rms ≤ 0.15 mm); 3D render spot-checked. Placeholders left: SPEC 110-102, TO-39, nano-SIM
  - `tools/check_footprints.py`: 15/15 Tier B footprints match datasheet pad count, pitch, exposed pad, numbering
- [x] H4 Docs: `requirements`, `block-diagram`, `reference-circuits`, `power-budget` (generated), `pin-map` (generated), `i2c-map`, `footprint-check` (generated)
- [x] H5 Schematic-as-code: `kicad/sylvia_node.py` (SKiDL 3.0) → `sylvia-node.net`; **ERC 0 errors, 0 warnings**; 161 parts, 88 nets
  - LCSC numbers verified for value + package (`check_bom_lcsc.py`); every pin has a pad (`check_netlist_pads.py`)
  - KiCad 9 loads it: starter `sylvia-node.kicad_pcb` (161 footprints); JLCPCB rules (`sylvia-node.kicad_dru`) parse in DRC
- [x] H6 `docs/layout-guide.md`, `docs/review-checklist.md`, `tools/jlc_export.py` (gerbers, BOM, CPL)
- [x] H7 Firmware: pure-C detection/power/payload/sensor maths, **73 host checks pass**; Bosch BME68x API vendored;
      drivers compile against ESP-IDF stub headers. Wi-Fi/MQTT/LoRa/OTA/main **not compiled** (no ESP-IDF here)
- [x] H8 `docs/tiers.md` (deck slide table)
- [x] H9 Hand-over (below)

## Decisions
- User (2026-10-25): download batch 1 approved; **Tier B battery = 2× LiFePO4 18650 in parallel (1S2P)**.
- User (2026-10-26): batch 2 approved except ESP-IDF; **USB/solar input = TPS2121 power mux** (USB priority).
  Found while checking the LM66100 datasheet: its 6 V absolute maximum is below the panel's ~7.5 V open-circuit voltage.
- Engineering calls inside the approved plan (flag in review if you disagree):
  - Charger **BQ24650**; CN3791 rejected (fixed 4.2 V float overcharges LiFePO4).
  - CO front end (LMP91000 + ADS1115) **always powered**: the cell needs continuous bias and they draw ~10 µA. The
    second load switch gates the alternates rail instead; a 0 Ω isolates the CO block for bring-up.
  - Both I2C buses at **100 kHz** (LMP91000 and SEN66 limits); SEN66 pull-ups on its switched rail.
  - SEN66 runs only −10..+50 °C and < 95 %RH (datasheet); CO + BME688 keep detecting when it's parked.
  - Board ~85 × 60 mm with both 18650 holders on the bottom.
- Rule for `sylvia_node.py`: new passives take the next free designator explicitly; never renumber (layout links by ref).

## What the ECE team does next (plan calendar)
1. **Nov 2–8:** review `docs/requirements.md` + `docs/block-diagram.md`. Install KiCad 9 and the Python venv (`README.md`).
2. **Nov 9–15:** review `parts/parts.csv` + `kicad/bom-draft.csv`; **order long-lead / low-stock parts now**:
   SEN66 (Mouser ~2,600 in stock), SPEC 110-102, RAK3172-9-SM-I (LCSC stock only 79; RAK store), LMP91000
   (LCSC stock 72), IFR18650 cells, 6 V 2 W panels, GH cables, antennas + pigtails. Decide on a pilot LoRaWAN gateway.
3. **Nov 16–22:** schematic review with `docs/review-checklist.md` sections A + B (each block against its datasheet;
   SPEC footprint and MAX17048 exposed pad need a human check).
4. **Nov 23 – Dec 13:** layout per `docs/layout-guide.md`, DRC clean, review section C.
5. **Dec 28 – Jan 3:** `tools/jlc_export.py`, re-run `check_bom_lcsc.py`, check rotations in JLCPCB's preview,
   **order before Feb 6, 2027**.

## Waiting on the user / team
- Fetch from a browser: nRF9151 Product Specification; MAX17048 outline 21-0168 / land pattern 90-0065 (analog.com
  is unreachable from this PC).
- Someone with ESP-IDF v5.4: `idf.py build` in `hardware/firmware` and fix what the compiler finds.
- Per-device secrets: run `firmware/tools/provision.py` and the printed `az iot hub device-identity create` yourself.
- Committed: the whole `hardware/` package is in the repo (commit 5f94b49, 2026-10-27). Datasheet PDFs, the Python venv, build output and per-device secrets stay local by design (see `hardware/.gitignore`).

## Known gaps (honest list)
- Wi-Fi/MQTT, LoRaWAN, OTA and `main.c` never compiled; drivers only checked against stub headers.
- Power-budget figures for wake time, SEN66 sample and Wi-Fi uplink are estimates until measured (checklist E).
- Detection thresholds are tuned on simulated traces, not field data; a charcoal barbecue (high CO) would look
  like smouldering. Advisories stay "unverified" Level 1–2 by design.
- DigiKey part numbers marked "verify": DigiKey/Mouser block scripted lookups from this PC.
- Tier B pilot cost is ~$244/node (plan said $110–170): see `docs/tiers.md`.

## Log
- 2026-10-25: Folder created. Parts researched, batch 1 downloaded, library, schematic, checks, docs, firmware, tiers.
- 2026-10-26: Batch 2: LM66100 + TPS2121 datasheets, Bosch BME68x API vendored, 6 EasyEDA 3D models fitted by pads.
  LM66100 replaced by TPS2121 (overvoltage from the panel). Designators kept stable. All checks pass.
