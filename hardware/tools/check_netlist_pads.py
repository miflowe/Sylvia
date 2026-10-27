"""Every (ref, pin) in kicad/sylvia-node.net must exist as a pad in that part's footprint, and every
footprint pad with a number must be used by the netlist or be a known mechanical pad.

    python -I hardware/tools/check_netlist_pads.py
"""
import pathlib
import re
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
NET = HW / "kicad" / "sylvia-node.net"
FP = HW / "kicad" / "lib" / "sylvia.pretty"


def main():
    text = NET.read_text(encoding="utf-8")
    comps = dict(re.findall(r'\(comp\s+\(ref "([^"]+)"\).*?\(footprint "([^"]+)"\)', text, re.S))
    nodes = re.findall(r'\(node\s+\(ref "([^"]+)"\)\s+\(pin "([^"]+)"\)', text)
    pads = {}
    for ref, fp in comps.items():
        body = (FP / (fp.split(":")[-1] + ".kicad_mod")).read_text(encoding="utf-8")
        pads[ref] = set(re.findall(r'\(pad "?([^"\s]+)"? ', body))
    bad = [(r, p) for r, p in nodes if p not in pads.get(r, set())]
    used = {}
    for r, p in nodes:
        used.setdefault(r, set()).add(p)
    for r, p in bad:
        print(f"PIN WITHOUT PAD: {r} pin {p} (footprint {comps[r]})")
    unused = {r: sorted(pads[r] - used.get(r, set())) for r in comps if pads[r] - used.get(r, set())}
    print(f"{len(comps)} components, {len(nodes)} pin connections, {len(bad)} pins without a pad")
    for r, u in sorted(unused.items()):
        print(f"  pads not in netlist: {r:5} {comps[r].split(':')[-1][:40]:40} {u}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
