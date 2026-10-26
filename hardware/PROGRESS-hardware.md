# Sylvia Node — hardware progress

Single source of truth for the Node design package (plan step 9). Updated after every chunk.
Resume: read this file, then continue from **Next action**. Never redo a ticked item.

**Current step:** H1 Parts list + research
**Next action:** Look up LCSC/DigiKey numbers and price snapshots for every part, then write `parts/parts.csv`.

## Checklist
- [ ] H1 `parts/parts.csv`: all tiers, alternates, key passives, price snapshot
- [ ] H2 Download batch approved by the user (datasheets, CAD, Python tools)
- [ ] H3 Part library: `datasheets/` (gitignored, sha256 in parts.csv), `kicad/lib/sylvia.kicad_sym`, `sylvia.pretty/`, `3dmodels/`
- [ ] H4 Docs: requirements, block diagram, power budget, I2C map, pin map, reference circuits
- [ ] H5 Schematic-as-code → KiCad netlist, ERC clean
- [ ] H6 `docs/layout-guide.md` + `docs/review-checklist.md`
- [ ] H7 Firmware skeleton (ESP-IDF) + detection logic tests
- [ ] H8 `docs/tiers.md` (deck slide)
- [ ] H9 Hand-over: what the ECE team does next

## Waiting on the user / team
- (none yet)

## Log
- 2026-10-25: Folder created. KiCad 9.0.6 is installed locally (official libs available offline). No C compiler or ESP-IDF on this PC.
