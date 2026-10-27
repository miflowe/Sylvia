# Tier B layout guide (for the ECE team)

You get a netlist and a starter board; you do placement, routing, DRC and the JLCPCB order.
Everything here comes from the datasheets in `hardware/datasheets/` (section numbers given) and JLCPCB's
published 4-layer capabilities. Ask in the team channel when something here conflicts with what you see.

## 0. Open the project
1. Install KiCad 9.0.x. Open `hardware/kicad/sylvia-node.kicad_pro`. The project's own `sym-lib-table` and
   `fp-lib-table` point at `lib/` (no global library setup needed).
2. `sylvia-node.kicad_pcb` is a **starter**: all 155 footprints with nets, unplaced, no outline. It was made
   by `tools/make_starter_pcb.py` and will not be overwritten once you start (the script refuses).
3. When the schematic changes: regenerate `sylvia-node.net` (`hardware/.venv/Scripts/python -I hardware/kicad/sylvia_node.py`),
   then in the PCB editor **File → Import → Netlist** (KiCad 9: *Update PCB from Netlist* with "Netlist file"),
   matching footprints by reference. Refs are fixed in the script, so placement survives.
4. Design rules are already loaded: `sylvia-node.kicad_dru` (custom rules) + board setup in the `.kicad_pro`
   (net classes Default / Power / Analog).

## 1. Board and stack-up
- **Size:** about 85 × 60 mm (the plan said ~60 × 80 before the second 18650: two Keystone 1042 holders are
  each ~77 × 21 mm, so put both on the **bottom side** under the electronics). Final size follows the enclosure.
- **4 layers, 1.6 mm, JLCPCB JLC04161H-7628** (1 oz outer, 0.5 oz inner):
  | Layer | Use |
  |---|---|
  | L1 F.Cu | components, signals, short power pours |
  | L2 In1.Cu | **solid GND**: no tracks. The RF and analog reference |
  | L3 In2.Cu | power: VBAT / 3V3 pours, a few slow signals if unavoidable |
  | L4 B.Cu | battery holders, signals, GND fill |
- 4× M3 mounting holes (`MountingHole_3.2mm_M3_Pad_Via`, add in the PCB editor, tie to GND) at the enclosure's bosses.
- Fiducials: JLCPCB adds panel fiducials; add 3 board fiducials only if you panelise yourself.

## 2. JLCPCB rules (already in the rule file)
| Item | Rule | JLCPCB 4-layer minimum |
|---|---|---|
| Track / space | ≥ 0.127 mm (signals 0.2 mm default) | 0.09 mm |
| Power tracks (`Power` class) | ≥ 0.5 mm (0.6 default) | — |
| Via | 0.3 mm drill / 0.6 mm pad (0.4/0.8 for power) | 0.15 mm drill |
| ESP32 module thermal vias | 0.2 mm (KiCad footprint): allowed, check the order page for a small-hole fee | — |
| Annular ring | ≥ 0.13 mm | 0.13 mm |
| Copper to board edge | ≥ 0.3 mm | 0.3 mm |
| Silk to pad | ≥ 0.15 mm | — |
| CO electrode tracks (`CO_WE/RE/CE`) | ≥ 0.3 mm clearance to everything | leakage control |

## 3. Placement (in this order)
1. **ESP32-S3-WROOM-1 (U1) on a board edge, antenna end overhanging or flush with the edge.** Espressif
   module datasheet, "PCB layout": no copper, tracks, components or ground pour under or around the antenna on
   **any layer**: at least 15 mm clearance around it inside the board (or let it overhang). Keep the LoRa
   pigtail, the buzzer, the battery and metal screws away from it.
2. **Power corner** (opposite end from the antenna): J1 USB-C and J3 solar at the board edge, then U14, D1, D2,
   the BQ24650 group (U6, Q1, Q2, L1, R19, C6–C14), then F1 + the battery leads, then U8 + L2 + C17–C22.
3. **Sensor edge** (the edge that faces the louvres / sample path): SPEC U15 at the very edge, LMP91000 U4 and
   ADS1115 U5 right next to it; BME688 U3 near the vent but ≥ 15 mm from U1, U6, U8, L1, L2 (they are warm);
   J2 SEN66 connector where the cable reaches the SEN66 in < 10 cm.
4. RAK3172 U2: anywhere away from U1's antenna; its IPEX pigtail runs to the SMA bulkhead.
5. Headers J6 (UART0) and J7 (SWD), buttons SW1/SW2, LED D7: reachable with the lid off.
6. Test points: in a row near the edge, labelled on silkscreen with their net names (they carry the names as
   values: VBAT, 3V3, I2C0_SDA …). Leave room for a probe tip.
7. TH1 (NTC) against the battery holders on the bottom side (or move it to a wired 103AT on the cells).

## 4. Routing, block by block
**BQ24650 charger (datasheet sec. 10 "Layout"):** keep the high-current loop VCHG caps → Q1 → PH → Q2 → GND tiny;
L1 right at PH; R19 sense lines SRP/SRN as a **Kelvin pair** straight from R19's pads, with C12 across them at
the IC; REGN/BTST/D3/C11 tight to the IC; exposed pad to GND with the footprint's thermal vias; no sensitive
signals under L1 or the PH node.

**TPS63020 buck-boost (datasheet sec. 10):** input caps C17/C18 and output caps C20–C22 within 2 mm of their pins,
L2 between L1/L2 pins with short wide traces, FB divider R23/R24 at the FB pin away from L2, PGND/GND joined
under the IC through the exposed pad + vias to L2 GND.

**USB-C:** D+/D− as a 90 Ω pair-ish (short; USB 2.0 full speed at these lengths is forgiving), routed
flow-through U13's pads (pin 1→6 for D−, 3→4 for D+), then to U1 pins 13/14. CC resistors near J1.

**CO front end:** U15 WE/RE/CE to U4 pins 12/13/14 as short as possible, on L1, with a GND guard ring and no other
signal crossing underneath on L2/L3 (L2 is GND anyway). Respect the footprint's keep-out under the sensor (no
tracks/vias/pour on L1/L2: the gas port and the hand-soldering area). CO_VOUT → U5 AIN0 short; VREF_CO filter
(R34/C33) at U4. Optional: a ring of exposed GND around the WE pads.

**I2C:** I2C0 short star around U3/U4/U5/U7 with R31/R32 near U1. I2C1 from U1 to J2 with D4/D5 at the connector
and R29/R30 near J2 (they're on the switched rail 3V3_SEN).

**Battery:** VCELL → F1 → VBAT as a pour/wide trace. Take MAX17048's CELL (U7 pin 2) from VBAT at F1's output
pad with its own thin trace (a Kelvin sense), not from somewhere along the charger or system current path.

**GND:** L2 solid. Stitch L1/L4 GND pours to L2 with vias every ~5 mm, more around U1 and the RF edge.

## 5. DRC, then outputs
1. Draw the outline on Edge.Cuts, place, route, pour zones (L1/L4 GND, L3 power), **Inspect → DRC**: 0 errors,
   0 unconnected. Check the 3D view (placeholder boxes are marked `_placeholder`).
2. `python -I hardware/tools/jlc_export.py` → `hardware/kicad/fab/`: gerber zip, drill, `sylvia-node-bom.csv`,
   `sylvia-node-cpl.csv`, `hand-solder.txt`.
3. Re-check every LCSC number: `python -I hardware/tools/check_bom_lcsc.py` (stock moves daily).

## 6. JLCPCB order
- PCB: 4 layers, 1.6 mm, JLC04161H-7628, HASL lead-free (or ENIG for the fine-pitch QFN/WSON parts: recommended),
  green or black mask, qty 5 (or 10).
- **Assembly:** "Standard" PCBA, top side, upload BOM + CPL. In the parts-review page: confirm every part,
  **then check every rotation in the placement preview** (pin 1 dots, diode/LED polarity, USB-C orientation).
  Fix wrong ones by adding the footprint to `ROTATION_FIX` in `tools/jlc_export.py`, re-export, re-upload.
- Not placed by JLCPCB (`hand-solder.txt`): **SPEC 110-102 (hand-solder only, ≤ 70 °C on the sensor body,
  never reflowed or washed)**, headers J6/J7, the DNP alternates, holders if out of stock (Keystone 1042 is
  orderable as an extended part). Solder the battery holders by hand on the bottom side.
- Order **before Chinese New Year (Feb 6, 2027)**: target gerbers/BOM/CPL final in the Dec 28 – Jan 3 week.
- Separately buy: SEN66 (Mouser/DigiKey), SPEC 110-102 (DigiKey/Maritex), 2–4 IFR18650 cells per Node, 6 V 2 W
  panel, GH 6-pin cable, IPEX→SMA pigtail + 915 MHz antenna, enclosure + cable glands + PTFE vent.
