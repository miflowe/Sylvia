# Sylvia Node: three tiers

Prices: USD, distributor snapshots of **2026-10-25** (JLCPCB/LCSC qty 1 via `tools/build_parts.py`, Mouser
for the SEN66, est. where marked). Re-run the tools before quoting. "Pilot" = a 5-unit JLCPCB order
(extended-part fees ≈ $3 per unique part per order are spread over 5 boards). "Volume" = 100+ units, est.

## Deck slide (copy this)
| | **A · Budget Wi-Fi** | **B · Resilient home** (building this) | **C · Off-grid rural** |
|---|---|---|---|
| Who | Renters, towns handing out units | Homes at the wildland edge | Ranches, cabins, no Wi-Fi |
| Senses | PM2.5, gas/VOC, T/RH (+ CO opt.) | PM1–10, **CO + CO2 ratio**, VOC, NOx, T/RH/P | B + IR heat, high-accuracy T/RH |
| Talks over | Home Wi-Fi | Wi-Fi + **LoRaWAN backup** | LTE-M/NB-IoT + LoRaWAN |
| Power | USB wall adapter | **Solar + 2× LiFePO4, ≥7 days dark** | 5 W solar, larger battery |
| Keeps working when… | power and Wi-Fi are on | the power or internet goes out | there is no grid and no Wi-Fi |
| Cost / node (pilot → volume) | **~$60–75 → ~$40** | **~$240 → ~$150** | **~$340 → ~$230** + $3–10/mo SIM |

One line for the voice-over: *"Tier B is what we're building: it keeps reporting for a week without sun or
Wi-Fi, and its CO-to-CO2 ratio tells smouldering vegetation apart from a barbecue."*

## Detail
### Tier A: Budget Wi-Fi
| Item | Part | Pilot $ |
|---|---|---|
| MCU + Wi-Fi 6 | ESP32-C6-WROOM-1-N8 | 4.31 |
| PM | Plantower PMSA003I (5 V) | ~20 (est.) |
| Gas/VOC + T/RH/P | BME688 | 11.50 |
| CO (optional) | Winsen ZE07-CO | 11–20 (LCSC out of stock) |
| Power | USB-C + AP2112K-3.3 + ESD | ~1 |
| 2-layer PCB + assembly share, passives | | ~8 |
| Vented IP65 ABS box + USB adapter | | ~16 (est.) |
| **Total** | | **~$61 without CO, ~$75 with** |
Trade-offs: cheapest and simplest; dies with home power or Wi-Fi, exactly when a fire takes them out. PM only
(PurpleAir-class) unless the ZE07 is added; no CO/CO2 ratio. PMSA003I MTTF ≥3 years.

### Tier B: Resilient home (this design)
| Item | Part | Pilot $ |
|---|---|---|
| Assembled board: ESP32-S3, RAK3172, BME688, LMP91000 + ADS1115, BQ24650, MAX17048, TPS63020, 2× holders… | 51 BOM lines (`kicad/bom-draft.csv`) | ~53.15 parts |
| PCB (4-layer) + assembly setup + stencil + 29 extended-part fees, ÷5 | JLCPCB | ~28 |
| PM + CO2 + VOC + NOx + RH/T | Sensirion SEN66 (Mouser, ~2,600 in stock) | 58.53 |
| CO cell (hand-soldered) | SPEC 110-102 | ~25 |
| 2× LiFePO4 18650 | IFR18650 1500–1800 mAh | ~12 |
| 6 V 2 W panel | | ~20 |
| 915 MHz antenna + IPEX→SMA pigtail | | ~9 |
| IP65 box, radiation shield, glands, PTFE vent, GH cable | | ~38 (est.) |
| **Total** | | **~$244 (pilot), ~$150 (volume: SEN66 $47 @250, no per-order fees, cheaper enclosure)** |
Trade-offs: survives power and internet loss (LoRaWAN), ≥7 days without sun (`power-budget.md`), the CO/CO2
ratio is the differentiator. Costs: rural LoRaWAN coverage is thin, so a pilot may need a gateway
(RAK7268V2, ~$170, one per neighbourhood); the SEN66 is rated for −10 to +50 °C, so it parks in deep winter
(CO + BME688 keep running).

### Tier C: Off-grid rural
| Item | Part | Pilot $ |
|---|---|---|
| Tier B board core (ESP32-S3-WROOM-1U, RAK3172, power, CO front end) | | ~75 |
| Cellular | nRF9151 SiP (~$16, certification work) or SIMCom SIM7080G (~$18) + nano-SIM holder + LTE antenna | ~25 |
| PM | Sensirion SPS30 (8-yr life, −10 to +60 °C) | 33.77 |
| CO2 (single-shot, battery-friendly) | SCD41 | 19.44 |
| VOC/NOx + high-accuracy T/RH | SGP41 + SHT45 | 14.74 |
| Radiant heat | MLX90614 (IR) | 6.64 |
| CO cell | SPEC 110-102 (or Alphasense CO-B4, quote) | ~25 |
| 5 W panel + larger LiFePO4 pack | | ~55 (est.) |
| UV-stable ASA or die-cast enclosure + shield | | ~50 (est.) |
| PCB + assembly share | | ~35 |
| **Total** | | **~$340 (pilot) + SIM $3–10/month; ~$230 at volume (est.)** |
Trade-offs: works anywhere with a cell signal, adds radiant-heat sensing near the treeline; highest cost,
monthly data fee, more power (LTE-M ~100–200 mA bursts), carrier certification for the nRF9151 path.

## What changed from the plan's estimates
- Tier B was ~$110–170 in the plan; the priced pilot build is ~$244. The gap: the second 18650 + holder
  (user decision), 29 extended-part fees spread over only 5 boards (~$17/board), and the SEN66 at $58.53 (the
  plan's ~$59 matched, but enclosure and cabling were under-counted). At volume it falls back into the plan's range.
- CN3791 (in the plan as a charger option) is not used: its 4.2 V float is unsafe for LiFePO4.
