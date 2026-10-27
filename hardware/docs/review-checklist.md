# Tier B review checklist

Tick each line with your initials + date in a PR. "Auto" lines are checked by a script; re-run it, don't
re-check by hand. Everything else needs a human with the datasheet open.

## A. Schematic (week of Nov 16–22)
- [ ] Auto: `hardware/.venv/Scripts/python -I hardware/kicad/sylvia_node.py` → **ERC: 0 errors, 0 warnings**
- [ ] Auto: `python -I hardware/tools/check_netlist_pads.py` → 0 pins without a pad
- [ ] Auto: `python -I hardware/tools/check_bom_lcsc.py` → all LCSC lines match value + package; note stock
- [ ] Auto: `python -I hardware/tools/pin_map.py` → board.h matches the netlist
- [ ] Each block in `docs/reference-circuits.md` compared with its datasheet's reference schematic (initial per block):
  - [ ] USB-C / USBLC6 / TPS2121 mux (PR1 4.33 V, ILM 1.5 A) · [ ] solar input · [ ] BQ24650 (MPPSET, VFB, TS, Rsense) · [ ] MAX17048 · [ ] TPS3840
  - [ ] TPS63020 · [ ] TPS22918 ×2 · [ ] TPS61023 (DNP) · [ ] SEN66 connector · [ ] LMP91000 + SPEC · [ ] ADS1115
  - [ ] BME688 · [ ] ESP32-S3 (EN/IO0/USB/strapping) · [ ] RAK3172 (RST/BOOT0/UART/SWD) · [ ] alternates J4/U16
- [ ] Recompute: V_float 3.60 V, I_chg 400 mA, MPPSET 4.44 V, TS 0–45 °C, VOUT 3.28 V, 5V_ALT 4.99 V
- [ ] LiFePO4 safety: float ≤ 3.65 V, no charging < 0 °C, UVLO 2.7 V, 2 A fuse, CN3791 NOT used
- [ ] No pull-up back-feeds a switched rail (I2C1 pull-ups are on 3V3_SEN)
- [ ] Every rail and bus has a test point; every subsystem has an isolation point (JP1, JP2, F1, R33, R42–R44)

## B. Footprints (before placement)
- [ ] Auto: `python -I hardware/tools/check_footprints.py` → 15/15 OK (pads, pitch, EP, numbering)
- [ ] Open each footprint in the footprint editor next to its datasheet drawing; overlay pad positions:
  - [ ] **SPEC 110-102** (drawn by us from the "PCB layout guidelines": pin offsets and keep-out; verify against a
        real sensor or the 3M socket 950502-60102-AR before ordering; the body-to-pin offset is unverified)
  - [ ] **MAX17048 TDFN-8**: exposed pad size not verified (ADI outline 21-0168 not reachable from the design PC)
  - [ ] LMP91000 WSON-14 (EasyEDA pads extend 0.24 mm past the body: fine for reflow, check paste)
  - [ ] TPS63020 DSJ (comb thermal pad), TPS22918, TPS3840, TPS61023, TPS2121 (VQFN-HR: pin 1 + IN/OUT bars), BQ24650 RVA
  - [ ] RAK3172 stamp pads + IPEX keep-out, ESP32-S3-WROOM-1 antenna keep-out
  - [ ] Keystone 1042 polarity (+ pad 1), JST GH and PH pin 1 vs the cable you'll buy
  - [ ] PMSA003I header J4: mating cable orientation (pin 1 = VCC; pins 6/8 must stay unconnected)
  - [ ] MLT-8530 buzzer: '−' wired to pad 4 (datasheet: '+'/'−' share an edge): check before fitting BZ1
  - [ ] SMF12A: pin 1 = cathode = SOLAR_IN side; LED D7 and diodes: cathode band vs silkscreen
- [ ] 3D view: placeholder boxes (`*_placeholder.wrl`) only where listed in `PROGRESS-hardware.md`

## C. Layout (Dec 7–13)
- [ ] `docs/layout-guide.md` sections 1–4 followed; deviations written down
- [ ] Antenna keep-out on all layers; no copper under the WROOM-1 antenna
- [ ] BQ24650 and TPS63020 power loops tight; Kelvin sense on R19; thermal pads stitched
- [ ] CO electrode tracks short, guarded, ≥ 0.3 mm from everything; keep-out under SPEC respected
- [ ] BME688 ≥ 15 mm from heat sources, near the vent
- [ ] L2 unbroken GND; GND stitching around U1 and the board edge
- [ ] DRC: 0 errors, 0 unconnected; silkscreen readable; test points labelled; board name + rev + date on silk
- [ ] Mounting holes match the enclosure drawing; connector positions match the cable glands

## D. Fabrication outputs (Dec 28 – Jan 3)
- [ ] `python -I hardware/tools/jlc_export.py`; open the gerber zip in JLCPCB's viewer (or KiCad's Gerber viewer)
- [ ] BOM: every line has an in-stock LCSC part (re-run `check_bom_lcsc.py` on the day)
- [ ] CPL: every rotation confirmed in JLCPCB's placement preview; `ROTATION_FIX` updated
- [ ] `hand-solder.txt` reviewed; SPEC sensors, cells, SEN66, cables, antennas ordered separately
- [ ] Order placed **before Feb 6, 2027** (Chinese New Year)

## E. Bring-up (when boards arrive), with a current-limited bench supply
1. [ ] Visual + continuity: VBAT, VCHG, 3V3 not shorted to GND. JP1, JP2 cut open first.
2. [ ] Bench 3.3 V into VBAT_SYS side of JP1 (limit 100 mA): TPS63020 starts, 3V3_REG = 3.28 V; close JP2.
3. [ ] USB-C: VBUS 5 V, VCHG ≈ 5 V (TPS2121 on IN1); with USB + panel connected VCHG stays on USB; flash a blink build over native USB.
4. [ ] I2C0 scan finds 0x36, 0x48, 0x49, 0x76. LS1 on → I2C1 finds 0x6B with the SEN66 attached.
5. [ ] Charger with a cell (or a 3.3 V source + load): STAT1 low, 400 mA ± 10 %, stops at 3.60 V; NTC cold (ice
       pack) blocks charging; IO10 high inhibits.
6. [ ] TPS3840: lower VBAT below 2.7 V → 3V3 turns off; back above ~2.83 V → on.
7. [ ] Sleep current at VBAT (µA meter across opened JP1): target ≤ 100 µA. Record it in `power-budget.md`.
8. [ ] CO: clean-air VOUT ≈ 0.2 × VREF; record the zero offset (`--co-zero` in provisioning); a CO source
       (e.g. a snuffed match in a jar) moves it up.
9. [ ] Wi-Fi MQTT to the IoT Hub test hub; LoRaWAN join + uplink through the pilot gateway.
10. [ ] Measure the four power-budget assumptions (wake, SEN66 sample, Wi-Fi uplink, LoRa uplink) and re-run
        `tools/power_budget.py`.
