# Download batch 1 (needs the user's OK)

Everything lands in a fresh, empty staging folder (`hardware/_staging/batch1/`, gitignored) and is inspected
(file type, page count / file format, no executables) before being moved into place.
Sizes come from HEAD requests on 2026-10-25; "?" means the server didn't report one.

## A. Python tools → `hardware/.venv` (gitignored), from PyPI
| Package | Why | Approx size |
|---|---|---|
| `easyeda2kicad` (+ `pydantic`) | Symbols/footprints/3D by LCSC number | ~3 MB |
| `skidl` (+ `kinparse`, `sexpdata`, `graphviz` bindings) | Schematic-as-code → KiCad netlist + ERC | ~3 MB |
| `ziglang` | Self-contained C compiler (clang) to build and run the firmware logic tests on Windows: no ESP-IDF needed for tests | ~55 MB |
| `pytest` | Runs the parts/netlist checks | ~1 MB |

## B. Datasheets → `hardware/datasheets/<MPN>.pdf` (gitignored; sha256 recorded in parts.csv)
| File | Source | Approx size |
|---|---|---|
| ESP32-S3-WROOM-1-N8R8.pdf | espressif.com | ~1 MB |
| ESP32-S3 chip datasheet (strapping/GPIO) | espressif.com | ~2 MB |
| ESP32-C6-WROOM-1-N8.pdf | espressif.com | ~1 MB |
| RAK3172-9-SM-I.pdf | LCSC copy (RAK only has an HTML page) | ~1.5 MB |
| SEN66-SIN-T.pdf (SEN6x) | sensirion.com | 1.7 MB |
| SM06B-GHS-TB.pdf (JST GH) | jst-mfg.com | 0.15 MB |
| 110-102.pdf (SPEC CO) | interlinkelectronics.com | 0.45 MB |
| LMP91000.pdf | ti.com | 0.9 MB |
| ADS1115.pdf | ti.com | 2.7 MB |
| BME688.pdf | bosch-sensortec.com | 2.0 MB |
| PMSA003I.pdf | cdn-shop.adafruit.com (Plantower manual) | 1.3 MB |
| ZE07-CO.pdf | LCSC copy (Winsen) | ~0.5 MB |
| SPS30.pdf | sensirion.com | 0.9 MB |
| SCD41-D-R2.pdf (SCD4x) | sensirion.com | 1.3 MB |
| SGP41-D-R4.pdf | sensirion.com | 1.1 MB |
| SHT45-AD1B-R2.pdf (SHT4x) | sensirion.com | 1.0 MB |
| MLX90614.pdf | melexis.com | 2.7 MB |
| nRF9151 product specification | nordicsemi.com (403 to scripts: may need the user) | ~10 MB |
| SIM7080G hardware design | LCSC copy | ~2 MB |
| SIM8060 (nano-SIM) drawing | gct.co | 0.9 MB |
| BQ24650.pdf | ti.com | 2.6 MB |
| CN3791.pdf, CN3722.pdf | LCSC copies | ~0.5 MB each |
| AO3400A.pdf | aosmd.com | 0.3 MB |
| MAX17048.pdf, MAX17260.pdf | analog.com | ~1.5 MB each |
| TPS63020.pdf, TPS63802.pdf | ti.com | 1.9 + 2.5 MB |
| TPS22918.pdf, TPS22917.pdf | ti.com | 1.1 + 1.7 MB |
| TPS3840.pdf, TPS61023.pdf | ti.com | 2.0 + 2.4 MB |
| AP2112.pdf | diodes.com | 0.8 MB |
| USBLC6-2.pdf | st.com | ~0.5 MB |
| TYPE-C-31-M-12, B5819W, SMF12A, 0466002, NCP18XH103, ESD9B5.0, KT-0603G, MLT-8530, 2N7002, 1N4148WS, TS-1187A, SWPA inductors, Keystone 1042, JST PH | LCSC copies / jst-mfg.com | ~0.2-1 MB each, ~6 MB total |

Subtotal ≈ 60 MB. Generic passives (0402/0603 R/C) get no PDF: family datasheets add nothing.

## C. CAD
| Item | Source | Approx size |
|---|---|---|
| easyeda2kicad by LCSC #: TPS63020 C15483, LMP91000 C2651584, MAX17048 C2682616, TPS22918 C131941, TPS3840PL27 C2066421, TPS61023 C919459, TPS63802 C2845237, MAX17260 C5280558, CN3722 C77905, CN3791 C154992, ESP32-C6-WROOM-1-N8 C5366877, RAK3172-9-SM-I C19723905 (3D only), nRF9151 C22397843, SIM7080G C2943992, SGP41 C3659325, MLX90614 C490604, MLT-8530 C94599, TS-1187A C318884, ZE07-CO C141345 | easyeda.com API (LCSC library) | ~20 parts, 50 KB-2 MB each (3D models are the bulk), ~15 MB |
| SEN6x STEP | sensirion.com | 4.2 MB |
| SPS30 STEP (zip) | sensirion.com | ~2 MB |
| SCD4x STEP, SGP40/41 STEP | sensirion.com | ~1 MB each |

KiCad official symbols/footprints/3D models are copied from the local KiCad 9.0.6 install: no download.
Manufacturer STEP files stay local (gitignored): they're copyrighted with no redistribution licence.

## Needs an account (user fetches, Claude doesn't)
- None required so far. If easyeda2kicad's 3D model for a part is missing or wrong, the fallback is
  SnapEDA / Ultra Librarian (account): candidates are **RAK3172** (3D), **SPEC 110-102** (3D), **ZE07-CO** (3D).
  Until then those get a simple box model marked "placeholder".
- **nRF9151 product specification**: if nordicsemi.com keeps refusing scripted downloads, the user saves it from a browser.
