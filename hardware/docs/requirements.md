# Sylvia Node: requirements (Tier B, "Resilient home")

Status: draft for ECE review (plan week Nov 2–8). Source decisions: `docs/decisions.md` and the approved plan.
"Shall" = must hold for the first PCB order. "Should" = target, may slip to rev B.

## 1. Purpose
Home-level early warning for wildfire smoke and nearby smouldering, plus hyperlocal air quality, feeding the Sylvia
app's "Sylvia Nodes" map layer. The CO/CO2 ratio (electrochemical CO + SEN66 CO2) is the Node's distinctive signal:
it helps tell smouldering vegetation from efficient combustion (a propane barbecue), which PM-only sensors such as
PurpleAir can't.

The Node is **not** a certified smoke or CO alarm and never replaces one. It never gives evacuation instructions.
Its local advisories are Level 1–2 and labelled "unverified" in the app; Level 3 comes only from official sources.

## 2. Functional requirements
| ID | Requirement |
|---|---|
| F1 | Shall measure PM1/2.5/4/10, CO2, VOC index, NOx index, T, RH (SEN66). |
| F2 | Shall measure CO with ≤1 ppm resolution, 0–1000 ppm range (SPEC 110-102 + LMP91000 + 16-bit ADC). |
| F3 | Shall measure gas resistance (VOC/H2 smoulder proxy), T, RH, pressure (BME688). |
| F4 | Shall wake every 60 s, read CO + BME688 + fuel gauge, run spike detection, sleep. |
| F5 | Shall sample the SEN66 on a schedule (5 min normal, 15 min saver) and continuously during a detector-requested burst (≤10 min per hour). |
| F6 | Shall detect PM slope and CO/CO2 ratio events locally and report level (0–2) + cause hint (smoulder / flaming / regional / unknown). |
| F7 | Shall publish over Wi-Fi via MQTT/TLS to Azure IoT Hub (JSON, every 5 or 15 min, immediately on a new advisory). |
| F8 | Shall fall back to LoRaWAN (US915, RAK3172) with an 11-byte payload when Wi-Fi is unavailable. |
| F9 | Shall support OTA firmware updates with rollback (two OTA slots). |
| F10 | Shall use per-device credentials (X.509 for IoT Hub, LoRaWAN AppKey) stored in encrypted NVS, never in the repo. |
| F11 | Should sound a local buzzer / LED pattern on a Level 2 advisory (user can disable). |
| F12 | Shall expose test points on every rail and bus, a UART debug header, and an SWD header for the RAK3172. |
| F13 | Shall let each subsystem be isolated with a 0 Ω jumper for bring-up (no dev kit: respin-risk control). |
| F14 | Should accept alternates without a respin: PMSA003I footprint (PM fallback, with a DNP 5 V boost) and ZE07-CO pads (CO fallback). |

## 3. Power requirements
| ID | Requirement |
|---|---|
| P1 | Shall run from 1S2P LiFePO4 18650 (~3000 mAh, 3.2 V nominal, 2.5–3.65 V) — user decision 2026-10-25. |
| P2 | Shall last **≥7 days without sun** (see `power-budget.md`: ~7.7 days at normal rates, ~20 days in saver). |
| P3 | Shall charge from a 6 V 2 W solar panel (input-voltage-regulated, ~MPP) and from USB-C 5 V. |
| P4 | Shall terminate charge at 3.60 V/cell (LiFePO4) and block charging below 0 °C and above 45 °C (NTC on TS). |
| P5 | Shall cut the 3.3 V rail below ~2.7 V battery (supervisor) to protect the cells. |
| P6 | Shall power-gate the SEN66 (and PM alternate) and the CO front end with load switches. |
| P7 | Shall fuse the battery lead (2 A) and protect the solar input against reverse polarity and transients. |
| P8 | Sleep floor should be ≤100 µA at the battery. |

## 4. Environmental requirements
| ID | Requirement |
|---|---|
| E1 | Outdoor, sheltered mount (under an eave / soffit, out of direct rain), IP65 enclosure with a radiation shield. |
| E2 | Operating: −30 to +50 °C for the board (RAK3172-T variant for < −20 °C). SEN66 is only run from −10 to +50 °C and below 95 %RH (datasheet limits; recommended 10–40 °C) — firmware gates it. |
| E3 | PM/CO2 sample path: louvred inlet → SEN66 → outlet, no recirculation; SPEC sensor behind a PTFE membrane, never sealed or conformally coated. |
| E4 | No condensation on the SEN66; Gore-type vent on the enclosure. |
| E5 | Wildfire season (Apr–Oct) is the design case; in deep winter the Node keeps CO + BME688 running and parks the SEN66. |

## 5. Radio / data requirements
| ID | Requirement |
|---|---|
| R1 | Wi-Fi 2.4 GHz via the ESP32-S3 PCB antenna; keep-out per Espressif (see `layout-guide.md`). |
| R2 | LoRaWAN US915 sub-band 2 (TTN/Helium/private). Pilots may need a gateway (RAK7268V2, ~$170). |
| R3 | Every reading carries device time + source (the app shows source + timestamp on every reading). |
| R4 | IoT Hub free tier: 8,000 messages/day/hub → ≤288 messages/day/Node in normal mode, so ~25 Nodes per free hub. |

## 6. Manufacturing requirements
| ID | Requirement |
|---|---|
| M1 | 4-layer PCB, ~60 × 80 mm, JLCPCB standard capabilities (see `layout-guide.md`). |
| M2 | JLCPCB assembly for all SMD parts except: SPEC 110-102 (hand-solder only, never reflow), 18650 holders and connectors if out of stock. SEN66 and panel are cabled. |
| M3 | Gerbers + BOM + CPL ready by early January 2027; order before Chinese New Year (Feb 6, 2027). |
| M4 | 5–10 boards for the pilot. |

## 7. Out of scope (rev A)
Certified alarm function · cellular (Tier C) · SGP41/SHT45/MLX90614 (Tier C) · on-board GNSS · French UI on the device.
