# Download batch 2: DONE 2026-10-26 (items 1–3 approved and fetched; item 4 ESP-IDF declined)

Added with the user's TPS2121 choice: TPS2121 datasheet (ti.com, 3.3 MB, four harmless /Launch link annotations,
reviewed and allow-listed by sha256 in `tools/fetch_datasheets.py`) and EasyEDA symbol/footprint/3D for C485916.
Also fetched: EasyEDA footprints for the six 3D-model parts (text files) so the models could be aligned by pads.

Items found missing while designing. Same rules as batch 1: staged in `hardware/_staging/batch2/`, inspected
before moving, datasheets gitignored with sha256 in `parts/datasheets.csv`.

| # | File | Source | Approx size | Why |
|---|---|---|---|---|
| 1 | LM66100 datasheet | ti.com/lit/ds/symlink/lm66100.pdf | ~1.5 MB | Added to the design (USB ideal diode); pinout currently trusted from KiCad's official symbol |
| 2 | Bosch BME68x SensorAPI (`bme68x.c`, `bme68x.h`, `bme68x_defs.h`, LICENSE) | github.com/boschsensortec/BME68x_SensorAPI (BSD-3-Clause) | ~0.2 MB | Firmware BME688 driver; without it the driver is a stub |
| 3 | EasyEDA 3D models: BQ24650 C53712, TYPE-C-31-M-12 C165948, LM66100 C2869734, ESP32-S3-WROOM-1U C2980300, SCD41 C3659294, SHT45 C5221601 | easyeda.com API via easyeda2kicad | ~6 MB | Replace placeholder boxes |
| 4 | ESP-IDF v5.4 + Xtensa toolchain (optional) | Espressif installer / `install.ps1` | ~1.5–2 GB | Compile the firmware on this PC; otherwise the ECE team builds it on theirs |

## Needs a browser / account (the user fetches)
| Item | Where | Why |
|---|---|---|
| nRF9151 Product Specification | docs.nordicsemi.com (refuses scripted downloads) | Tier C reference |
| MAX17048 package outline 21-0168 + land pattern 90-0065 | analog.com (unreachable from this PC) | Verify the TDFN-8 exposed pad (review-checklist B) |
| SnapEDA / Ultra Librarian 3D for SPEC 110-102 and RAK3172 (if EasyEDA's RAK model looks wrong) | snapeda.com (account) | Replace the SPEC placeholder box |
