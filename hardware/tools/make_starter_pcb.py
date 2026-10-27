"""Create a starter KiCad board from the netlist: every footprint loaded, every pad on its net.

Run with KiCad's own Python (it provides pcbnew):
    "C:/Program Files/KiCad/9.0/bin/python.exe" hardware/tools/make_starter_pcb.py

This proves KiCad itself resolves every footprint in the netlist. The ECE team then opens
hardware/kicad/sylvia-node.kicad_pcb, sets the 4-layer stack-up, draws the outline and places parts
(docs/layout-guide.md). It refuses to overwrite a board that already exists, so layout work is never lost:
after that, use Tools > Update PCB from netlist (File > Import > Netlist) instead.
"""
import os
import pathlib
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
KICAD_DIR = HW / "kicad"
BOARD = KICAD_DIR / "sylvia-node.kicad_pcb"
# kinet2pcb, hierplace and simp_sexp are pure Python: borrow them from the project venv.
sys.path.append(str(HW / ".venv" / "Lib" / "site-packages"))

import pcbnew  # noqa: E402,F401  (fail early if not run under KiCad's Python)
from kinet2pcb import kinet2pcb  # noqa: E402


def main():
    if BOARD.exists() and "--force" not in sys.argv:
        sys.exit(f"{BOARD} exists: refusing to overwrite layout work (pass --force for a fresh starter).")
    pro = KICAD_DIR / "sylvia-node.kicad_pro"
    pro_text = pro.read_text(encoding="utf-8") if pro.exists() else None  # pcbnew rewrites it with defaults
    os.chdir(KICAD_DIR)  # kinet2pcb reads ./fp-lib-table
    os.environ["KIPRJMOD"] = str(KICAD_DIR)
    kinet2pcb(str(KICAD_DIR / "sylvia-node.net"), str(BOARD), fp_lib_dirs=[str(KICAD_DIR / "lib" / "sylvia.pretty")])
    if pro_text is not None:
        pro.write_text(pro_text, encoding="utf-8")
    board = pcbnew.LoadBoard(str(BOARD))
    fps = board.GetFootprints()
    unconnected = sum(1 for fp in fps for pad in fp.Pads() if pad.GetNetname() == "" and pad.GetNumber() not in ("",))
    print(f"{BOARD.name}: {len(fps)} footprints, {board.GetNetCount()} nets, {unconnected} pads without a net")


if __name__ == "__main__":
    main()
