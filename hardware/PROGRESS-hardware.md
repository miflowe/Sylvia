# Sylvia Node — hardware progress

Single source of truth for the Node design package (plan step 9). Updated after every chunk.
Resume: read this file, then continue from **Next action**. Never redo a ticked item.

**Current step:** H3 Part library
**Next action:** Run `tools/fetch_batch1.py` (datasheets → `_staging/batch1/`), inspect, move to `datasheets/`, re-run `tools/build_parts.py` for sha256.

## Decisions (user, 2026-10-25)
- Download batch 1 approved in full (`parts/download-batch-1.md`).
- Tier B battery: **2× LiFePO4 18650 in parallel (1S2P, ~3000 mAh)** + firmware power-saver mode.
- Engineering calls (within the approved plan): charger = **BQ24650** (CN3791 rejected: fixed 4.2 V float is unsafe
  for LiFePO4); SEN66 kept (Mouser had ~2,600 in stock, $58.53, snapshot 2026-10-25).

## Checklist
- [x] H1 `parts/parts.csv`: all tiers, alternates, key passives, price snapshot (`tools/build_parts.py` regenerates it)
- [x] H2 Download batch approved by the user (datasheets, CAD, Python tools)
- [ ] H3 Part library: `datasheets/` (gitignored, sha256 in parts.csv), `kicad/lib/sylvia.kicad_sym`, `sylvia.pretty/`, `3dmodels/`
- [ ] H4 Docs: requirements, block diagram, power budget, I2C map, pin map, reference circuits
- [ ] H5 Schematic-as-code → KiCad netlist, ERC clean
- [ ] H6 `docs/layout-guide.md` + `docs/review-checklist.md`
- [ ] H7 Firmware skeleton (ESP-IDF) + detection logic tests
  - [x] Pure-C core: `components/detect`, `power_policy`, `payload` (LoRa 11 B + JSON + Sensirion CRC)
  - [x] Host tests: `.venv/Scripts/python -I firmware/test/host/run_tests.py` → 59 checks pass (7 simulated scenarios, closed loop with the power policy)
  - [ ] ESP-IDF app: drivers, 60 s cycle, Wi-Fi MQTT, LoRaWAN, OTA, provisioning
- [ ] H8 `docs/tiers.md` (deck slide)
- [ ] H9 Hand-over: what the ECE team does next

## Waiting on the user / team
- (none yet)

## Log
- 2026-10-25: Folder created. KiCad 9.0.6 is installed locally (official libs available offline). No C compiler or ESP-IDF on this PC.
