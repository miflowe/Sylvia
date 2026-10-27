# Sylvia Node hardware

Home wildfire-smoke and smoulder sensor for the Sylvia app. **Tier B "Resilient home"** is the board being
built: ESP32-S3 + RAK3172 LoRaWAN backup, Sensirion SEN66, SPEC CO cell + LMP91000, BME688, solar charging
into 2× LiFePO4 18650, 4-layer PCB for JLCPCB. Status and next steps: **`PROGRESS-hardware.md`**.

## Start here
| You are… | Read |
|---|---|
| Reviewing the design | `docs/requirements.md` → `docs/block-diagram.md` → `docs/reference-circuits.md` → `docs/review-checklist.md` |
| Doing the PCB layout | `docs/layout-guide.md`, then open `kicad/sylvia-node.kicad_pro` in KiCad 9 |
| Writing firmware | `firmware/README.md`, `docs/pin-map.md`, `docs/i2c-map.md` |
| Making the deck slide | `docs/tiers.md` |
| Ordering parts | `parts/parts.csv` (all tiers, LCSC numbers, price snapshot), `kicad/bom-draft.csv` (Tier B board) |

## Folder map
| Path | What |
|---|---|
| `kicad/sylvia_node.py` | **Schematic as code** (SKiDL). The source of truth for the circuit |
| `kicad/sylvia-node.net` | Generated KiCad netlist · `sylvia_node.erc` ERC report · `bom-draft.csv` |
| `kicad/sylvia-node.kicad_pcb` | Starter board (all footprints + nets, unplaced) for the layout |
| `kicad/lib/` | Project library: `sylvia.kicad_sym`, `sylvia.pretty/`, `3dmodels/` |
| `parts/` | `parts.csv`, `datasheets.csv` (URL + sha256), download batch lists |
| `datasheets/` | Local PDFs only (copyrighted, gitignored): `tools/fetch_datasheets.py` re-fetches them |
| `docs/` | Requirements, block diagram, reference circuits, power budget, pin + I2C maps, layout guide, checklists, tiers |
| `firmware/` | ESP-IDF firmware; pure-C logic tested on the host |
| `tools/` | Generators and checks (below) |

## Setup (Windows, once)
```bash
python -m venv hardware/.venv
```
```bash
hardware/.venv/Scripts/python -m pip install easyeda2kicad skidl ziglang pytest
```
KiCad 9.0.x must be installed at `C:/Program Files/KiCad/9.0` (used for its libraries, `kicad-cli` and Python).

## Commands
| Command | Does |
|---|---|
| `hardware/.venv/Scripts/python -I hardware/tools/verify_all.py` | **Every check**: ERC, pin/pad, footprints, pin map, power budget, firmware tests, LCSC numbers |
| `hardware/.venv/Scripts/python -I hardware/kicad/sylvia_node.py` | Regenerate netlist + ERC + draft BOM |
| `python -I hardware/tools/build_parts.py` | Refresh `parts.csv` prices/stock from JLCPCB (snapshot) |
| `python -I hardware/tools/build_library.py` | Rebuild the KiCad library from KiCad + EasyEDA + our own parts |
| `"C:/Program Files/KiCad/9.0/bin/python.exe" hardware/tools/make_starter_pcb.py` | Starter board (refuses to overwrite) |
| `python -I hardware/tools/jlc_export.py` | Gerbers + JLCPCB BOM/CPL from the finished board |
| `python -I hardware/tools/power_budget.py` | Regenerate `docs/power-budget.md` |

## Licences
KiCad library content: CC-BY-SA-4.0 with the KiCad library exception. EasyEDA/LCSC-derived symbols, footprints
and `.wrl` models: LCSC/EasyEDA library terms. Manufacturer STEP models and datasheets stay local (gitignored).
Our own footprints and code: the repository's licence.
