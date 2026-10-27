"""Export JLCPCB fabrication + assembly files from the laid-out board.

    python -I hardware/tools/jlc_export.py            # -> hardware/kicad/fab/

Writes:
  fab/gerbers/*.g* + drill files, zipped as fab/sylvia-node-gerbers.zip (upload as "Gerber file")
  fab/sylvia-node-bom.csv   Comment, Designator, Footprint, LCSC Part #   (DNP and no-LCSC parts excluded)
  fab/sylvia-node-cpl.csv   Designator, Mid X, Mid Y, Layer, Rotation
  fab/hand-solder.txt       parts JLCPCB won't place (SPEC sensor, headers, holders without stock, DNP list)

Rotation: KiCad and JLCPCB disagree on the zero angle of some packages. ROTATION_FIX starts empty on purpose:
after the first upload, check every part in JLCPCB's placement preview and add the needed offsets here
(keyed by footprint name), so the next export is right. EasyEDA-sourced footprints usually need none.
"""
import csv
import pathlib
import re
import subprocess
import sys
import zipfile

HW = pathlib.Path(__file__).resolve().parents[1]
KICAD_CLI = r"C:/Program Files/KiCad/9.0/bin/kicad-cli.exe"
BOARD = HW / "kicad" / "sylvia-node.kicad_pcb"
FAB = HW / "kicad" / "fab"
ROTATION_FIX = {}  # e.g. "SOT-23": 180, filled in after checking JLCPCB's preview
HAND_SOLDER = {"U15"}  # SPEC 110-102: never reflow


def cli(*args):
    subprocess.run([KICAD_CLI, *args], check=True)


def footprint_fields():
    text = BOARD.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'\(footprint "([^"]+)"', text):
        start = m.start()
        depth, i = 0, start
        while True:
            c = text[i]
            depth += c == "("
            depth -= c == ")"
            i += 1
            if depth == 0:
                break
        blk = text[start:i]
        ref = re.search(r'\(property "Reference" "([^"]+)"', blk)
        if not ref:
            continue
        props = dict(re.findall(r'\(property "([^"]+)" "([^"]*)"', blk))
        props["_fp"] = m.group(1).split(":")[-1]
        props["_dnp"] = "(attr" in blk and "dnp" in re.search(r"\(attr[^)]*\)", blk).group(0) if re.search(r"\(attr[^)]*\)", blk) else False
        out[ref.group(1)] = props
    return out


def netlist_fields():
    """LCSC/DNP per ref from the SKiDL netlist: the source of truth, whether or not the board copied them."""
    text = (HW / "kicad" / "sylvia-node.net").read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'\(comp\s+\(ref "([^"]+)"\)(.*?)\(tstamps', text, re.S):
        out[m.group(1)] = dict(re.findall(r'\(name "([^"]+)"\)\s*"([^"]*)"', m.group(2)))
    return out


def main():
    if not BOARD.exists():
        sys.exit("no board yet")
    gerb = FAB / "gerbers"
    gerb.mkdir(parents=True, exist_ok=True)
    cli("pcb", "export", "gerbers", "--layers", "F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,"
        "F.Mask,B.Mask,Edge.Cuts", "--subtract-soldermask", "-o", str(gerb), str(BOARD))
    cli("pcb", "export", "drill", "--format", "excellon", "--excellon-separate-th", "-o", str(gerb) + "/", str(BOARD))
    with zipfile.ZipFile(FAB / "sylvia-node-gerbers.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in gerb.iterdir():
            z.write(f, f.name)

    pos = FAB / "pos.csv"
    cli("pcb", "export", "pos", "--format", "csv", "--units", "mm", "--side", "both", "-o", str(pos), str(BOARD))
    fields = footprint_fields()
    net = netlist_fields()
    bom, cpl, hand = {}, [], []
    for row in csv.DictReader(pos.open(encoding="utf-8")):
        ref = row["Ref"]
        f = {**net.get(ref, {}), **{k: v for k, v in fields.get(ref, {}).items() if v}}
        lcsc = f.get("LCSC", "")
        dnp = f.get("DNP") == "DNP" or f.get("_dnp")
        if dnp or not lcsc or ref in HAND_SOLDER:
            hand.append(f"{ref:6} {row['Val']:24} {'DNP' if dnp else 'hand-solder' if ref in HAND_SOLDER else 'no LCSC part'}")
            continue
        key = (row["Val"], f["_fp"], lcsc)
        bom.setdefault(key, []).append(ref)
        rot = (float(row["Rot"]) + ROTATION_FIX.get(f["_fp"], 0)) % 360
        cpl.append([ref, row["PosX"] + "mm", row["PosY"] + "mm", "Top" if row["Side"] == "top" else "Bottom", f"{rot:g}"])
    with (FAB / "sylvia-node-bom.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Comment", "Designator", "Footprint", "LCSC Part #"])
        for (val, fp, lcsc), refs in sorted(bom.items()):
            w.writerow([val, ",".join(refs), fp, lcsc])
    with (FAB / "sylvia-node-cpl.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Designator", "Mid X", "Mid Y", "Layer", "Rotation"])
        w.writerows(cpl)
    (FAB / "hand-solder.txt").write_text("\n".join(sorted(hand)) + "\n", encoding="utf-8")
    print(f"BOM lines {len(bom)}, placements {len(cpl)}, not placed by JLCPCB {len(hand)} -> {FAB}")


if __name__ == "__main__":
    main()
