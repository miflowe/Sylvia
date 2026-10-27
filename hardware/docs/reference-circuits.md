# Tier B reference circuits

The circuit itself lives in `kicad/sylvia_node.py` (the source of truth; refs below match it). This page explains
each block: which datasheet reference design it follows, every value and why, and what we changed.
Datasheets: `hardware/datasheets/` (local; URLs + sha256 in `parts/datasheets.csv`).

Conventions: 0402 passives unless noted; caps X5R/X7R; "DNP" = footprint present, not fitted on the default build.

---

## 1. Power input: USB-C + solar → TPS2121 → VCHG
| Ref | Part | Value / connection | Why |
|---|---|---|---|
| J1 | TYPE-C-31-M-12 | USB 2.0 receptacle | Programming (ESP32-S3 native USB) and charging |
| R7, R8 | 5.1 kΩ | CC1, CC2 → GND | Identifies the Node as a sink: any USB-C source gives 5 V |
| U13 | USBLC6-2SC6 | D+/D− + VBUS | ESD on the connector lines. Pins 1/6 and 3/4 are joined inside: route each line straight through its pad pair (flow-through) |
| R9 + C4 | 1 MΩ ∥ 4.7 nF | shield → GND | Bleeds ESD charge from the shell without a hard ground loop |
| C5 | 4.7 µF 0603 | VBUS | USB allows ≤10 µF on VBUS |
| U14 | **TPS2121 power mux** | IN1 = VBUS, IN2 = solar (after D2), OUT = VCHG | Replaces a planned LM66100: that part is rated 6 V max on VOUT/CE and the panel lifts the charger input to ~7.5 V open-circuit. The TPS2121 is rated 2.8–22 V, blocks reverse current on the unused input and drops only ~56 mΩ, so USB reaches BQ24650 at ≈5 V (a Schottky would leave ~4.6 V, below its characterised 5 V) |
| R47/R48 | 309k/100k on PR1, CP2 = GND | Priority mode (datasheet Table 9-3): USB selected whenever VBUS > 1.06 × (1 + 309/100) = **4.33 V**. USB always wins when present, so a loaded panel (held at 4.44 V by MPPSET) and USB never hand over back and forth |
| R49 | 80.6k ILM | I_LM = 65.2 / 80.6^0.861 ≈ **1.5 A** (datasheet eq. 2; charger draws ≤0.35 A) |
| C40 | 100 nF SS | ~780 V/s soft start → ~35 mA inrush into VCHG's 44 µF |
| C38, C39 | 1 µF IN1, IN2 | Input decoupling. OV1/OV2 and ST tied to GND (datasheet: "connect to GND if not required") |
| R10/R11 | 100k/100k | VBUS → IO38 | VBUS detect (2.5 V) |
| J3 | JST PH 2-pin | Solar + / − | 6 V 2 W panel through a cable gland |
| D1 | SMF12A | SOLAR_IN → GND, **pin 1 = cathode** | Transients on a long outdoor lead; 12 V stand-off clears the panel's ~8 V cold Voc |
| D2 | B5819W | SOLAR_IN → SOLAR_MUX (TPS2121 IN2) | Reverse-polarity block: IN2 tolerates only −0.3 V |

## 2. Charger: BQ24650 (U6), LiFePO4 float 3.60 V, 400 mA
Follows the BQ24650 datasheet typical application (sync buck, 600 kHz). We replaced the plan's CN3791 option:
its float voltage is fixed at 4.2 V, which would overcharge LiFePO4 (max 3.65 V).
| Ref | Value | Calculation / reason |
|---|---|---|
| C6, C7, C8 | 2× 22 µF 25 V 0805 + 100 nF | VCHG input |
| R12 / R13 | **270 k / 100 k** MPPSET | VCHG regulated to 1.2 × (1 + 270/100) = **4.44 V**. Above VCC_LOWV (4.35 V rising) so USB (4.9 V) charges; the 6 V panel is held at 4.44 V when overloaded (≈80 % of MPP power in weak light; at full sun the charger is current-limited and the panel sits near Vmp) |
| Q4 + R14 | 2N7002 on MPPSET, 100k pull-down | Firmware charge inhibit (IO10 high = MPPSET < 75 mV = charge off). Default: charging enabled |
| R15/R16 | 10k to 3V3 | STAT1 (charging) → IO12, STAT2 (done) → IO13, open-drain |
| C9 | 1 µF | VREF (3.3 V LDO in the charger) |
| TERM_EN | → VREF | Termination enabled (stops at C/10 = 40 mA, recharges 3 % below float) |
| R17 / R18 / TH1 | **4.42 k / 21.5 k / 10 k NTC (B 3380)** | TS window: VLTF 73.5 %, VHTF 47.5 % of VREF → charging only between **0 °C and 45 °C** (LiFePO4 must never charge below 0 °C). R(0 °C) = 28.2 k, R(45 °C) = 4.90 k; RT2 = 21.7 k, RT1 = 4.42 k (TI's TS equations). TH1 sits against the cells |
| C10 | 1 µF | REGN (6 V gate drive) |
| D3 + C11 | 1N5819WS + 100 nF | Bootstrap REGN → BTST, BTST–PH |
| Q1, Q2 | AO3400A | High-/low-side switches (30 V, logic-level, Vgs max 12 V > REGN 6 V) |
| L1 | 15 µH SWPA6045S | Datasheet table for ≤0.5 A charge; ripple ≈ 0.16 A at 6 V in |
| R19 | **0.1 Ω 0805** | I_CHG = 40 mV / 0.1 Ω = **400 mA** (0.13 C for 3000 mAh) |
| C12, C13, C14 | 100 nF SRP–SRN, 100 nF SRN–GND, 22 µF VBAT | Datasheet filtering |
| R20 / R21 | **71.5 k / 100 k** VFB | V_float = 2.1 × (1 + 71.5/100) = **3.60 V**. Low values keep the 100 nA VFB leakage error < 5 mV (1 MΩ dividers would allow up to ~70 mV) |

## 3. Battery, protection, fuel gauge, UVLO
| Ref | Part | Notes |
|---|---|---|
| BT1, BT2 | Keystone 1042 holders | **1S2P** (user decision). Insert matched cells at the same state of charge |
| F1 | 2 A fast fuse 1206 | Cell short protection; remove to isolate the battery |
| U7 | MAX17048 | VDD + CELL on VBAT (C15), ALRT pull-up R22, CTG + QSTRT → GND (datasheet application circuit), ALRT → IO11 (wakes the ESP32), 0x36. **Caveat:** ModelGauge is voltage-based and LiFePO4's curve is flat: firmware combines SoC with charge state and time. Alternate: MAX17260 coulomb counter |
| U9 | TPS3840PL27 | (C16) Push-pull active-low output drives TPS63020 EN: 3.3 V turns off below 2.7 V (rises again at ~2.83 V). 0.3 µA. Protects the cells from deep discharge (LiFePO4 18650s are unprotected) |

## 4. 3.3 V buck-boost: TPS63020 (U8)
TI's "simplified schematic" values.
| Ref | Value | Notes |
|---|---|---|
| JP1 | Bridged solder jumper VBAT → VBAT_SYS | Cut to measure system current or power from a bench supply |
| C17, C18, C19 | 2× 10 µF + 100 nF | VIN / VINA |
| L2 | 1.5 µH SWPA4020S | Datasheet recommended value |
| C20–C22 | 3× 22 µF | VOUT |
| R23 / R24 | **1 M / 180 k** | VOUT = 0.5 × (1 + 1000/180) = 3.28 V (TI table) |
| PS/SYNC | GND | Power-save mode for µA-level sleep |
| PG | → TP | Open-drain power-good, test only |
| JP2 | Bridged jumper 3V3_REG → 3V3 | Isolates the converter from the loads |

## 5. Load switches: TPS22918 (U10 LS1, U11 LS2)
| Ref | Notes |
|---|---|
| U10 | 3V3 → **3V3_SEN** (SEN66). ON = IO8 with 100k pull-down R25 (off at boot). CT = 1 nF (C23) for a slow ramp (SEN66 inrush). QOD tied to VOUT (quick discharge so the SEN66 really resets) |
| U11 | 3V3 → **3V3_ALT** (5 V boost for the alternates). ON = IO9, 100k pull-down R26 |
| — | **Why the CO front end is not switched:** the electrochemical cell needs continuous bias; LMP91000 + ADS1115 draw ~10 µA; switching them off would cost minutes of re-stabilisation per wake. A 0 Ω (R33) isolates it for bring-up instead |

## 6. SEN66 (J2) on I2C1
Sensirion SEN6x datasheet sec. 3: 6-pin JST GH, pins 1/6 VDD and 2/5 GND joined inside the sensor, external
pull-ups required, ≤100 kHz, cable < 10 cm.
| Ref | Notes |
|---|---|
| J2 | SM06B-GHS-TB, shield pads to GND |
| R29, R30 | 4.7 k pull-ups **on 3V3_SEN**: when the SEN66 is off, nothing back-feeds it through SDA/SCL. Firmware sets IO6/IO7 to inputs before switching LS1 off |
| D4, D5 | ESD9B5.0ST5G on SDA/SCL at the connector (cable leaves the board) |

## 7. CO channel: SPEC 110-102 + LMP91000 (U4) + ADS1115 (U5)
Follows the LMP91000 datasheet "3-lead amperometric cell" application (sec. 7.3.1.6.1) with SPEC's pin package.
| Ref | Value | Notes |
|---|---|---|
| R33 | 0 Ω | 3V3 → 3V3_CO isolation |
| U15 | SPEC 110-102 | WE = pins 1 + 6, RE = 4, CE = 5, pins 2/3 NC. **Hand-solder after reflow; never reflow, wash or conformal-coat it.** Keep-out under the sensor (in the footprint) |
| U4 config (firmware) | LOCK = 0; TIACN = 0x1C (RTIA 350 kΩ, RLOAD 10 Ω); REFCN = 0x80 (external ref, INT_Z 20 %, bias 0 %); MODECN = 0x03 (3-lead) | Sensitivity 4.75 nA/ppm × 350 kΩ = **1.66 mV/ppm**; zero at 0.2 × VREF = 0.66 V; full scale ≈ 1,500 ppm (typ.) |
| R34 + C33 | 1 kΩ + 1 µF | RC-filtered external VREF (keeps buck-boost ripple out of the zero point) |
| C34 | 100 nF C1–C2 (DNP) | Optional extra TIA low-pass |
| MENB | GND | Always enabled (only one LMP91000 on the bus) |
| U5 ADS1115 | ADDR = VDD → **0x49** | AIN0 = CO_VOUT, AIN1 = VREF (ratiometric: ppm = (V0 − 0.2·V1)/(RTIA·S)), AIN2 = ZE07 DAC (alt), AIN3 = spare TP. FSR ±4.096 V → 125 µV LSB = 0.08 ppm |
| R35 | 1 kΩ | CO_VOUT → IO1 (ESP32 ADC backup path) |

## 8. BME688 (U3) on I2C0
Bosch datasheet sec. 6 (I2C): CSB → VDDIO selects I2C, SDO → GND = **0x76**, 100 nF on VDD and VDDIO.
Place away from the buck-boost and the ESP32 module (self-heating), near a vent.

## 9. MCU: ESP32-S3-WROOM-1-N8R8 (U1)
Espressif module datasheet "peripheral schematic": EN = 10 k pull-up + 1 µF (R1, C3) + RESET button; IO0 = 10 k
pull-up + BOOT button; 22 µF + 100 nF at 3V3. USB D+/D− direct to IO20/IO19. **Never use GPIO26–37** (flash +
octal PSRAM) or the strapping pins IO3/45/46. Antenna keep-out: `layout-guide.md`.
Buttons SW1/SW2 (TS-1187A): pads A–B and C–D are joined inside the switch, so A+B go to the signal and C+D to GND.

## 10. LoRaWAN: RAK3172-9-SM-I (U2)
RAK3172 datasheet: VDD 3.3 V, UART2 = AT commands, SWD on PA13/PA14, BOOT0 high = bootloader.
| Ref | Notes |
|---|---|
| R42 | 0 Ω 3V3 → 3V3_LORA isolation; 10 µF + 100 nF |
| R43, R44 | 0 Ω in TX/RX: lift to test either side alone |
| RST | IO16 (open-drain in firmware) + 10 k pull-up; also on the SWD header |
| BOOT0 | IO39 + 10 k pull-down (normal boot). ESP32 can put the RAK into its UART bootloader for updates |
| J7 | SWD header: 3V3_LORA, SWDIO, SWCLK, RST, GND |
| Antenna | Module's IPEX → u.FL-to-SMA pigtail → 915 MHz antenna outside the box |

## 11. Alternates (no respin needed)
| Ref | What | Notes |
|---|---|---|
| U12 TPS61023 + L3 + R27/R28 + C27/C28 (DNP) | 5 V boost from 3V3_ALT | VOUT = 0.6 × (1 + 732/100) = 4.99 V; 1 µH per datasheet |
| J4 (DNP) | PMSA003I 2×5 1.27 mm header | VCC 1/2 = 5V_ALT, GND 3/4, SCL 7, SDA 9 (I2C1, 0x12), SET 10 = IO40, RESET 5 + pins 6/8 NC (datasheet: 6/8 must stay unconnected). Fit when the SEN66 is unavailable |
| U16 (DNP) | ZE07-CO pads | Vin 15 = 5V_ALT, GND 5/14, TXD 8 → 1k → IO41, RXD 7 ← 1k ← IO42 (module is 3.0 V logic), DAC 10 → ADS1115 AIN2 (+ 0 Ω DNP to IO2) |

## 12. UI, debug, test points, isolation
- LED D7 (green, 1 k) on IO14. Buzzer BZ1 (MLT-8530, DNP pads): 2N7002 Q3 low-side, 1N4148WS flyback, IO15 PWM at
  2.7 kHz. Datasheet: '+' and '−' share an edge; '−' wired to pad 4 (verify on the part before fitting).
- Tamper: two pads (IO21 with 100 k pull-up, GND) for a lid switch.
- UART0 header J6 (3V3, TX, RX, GND). RAK SWD header J7.
- **Test points on every rail and bus:** VBUS, SOLAR_IN, VCHG, VBAT, BB_EN, BB_PG, 3V3, 3V3_SEN, 3V3_ALT, 5V_ALT,
  3V3_CO, I2C0 SDA/SCL, I2C1 SDA/SCL, LORA_TX/RX, CO_VOUT, AIN3, CHG_STAT1/2, FG_ALRT, IO48, GND ×2.
- **Isolation:** JP1 (battery → system), JP2 (regulator → 3V3), F1 (cells), R33 (CO front end), R42 (LoRa supply),
  R43/R44 (LoRa UART), LS1/LS2 (sensor rails).
