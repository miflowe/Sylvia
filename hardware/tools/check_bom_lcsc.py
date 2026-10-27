"""Verify every LCSC number in kicad/bom-draft.csv against JLCPCB's live listing.

    python -I hardware/tools/check_bom_lcsc.py

For each line: the LCSC part must exist, its package must match the footprint size (0402/0603/0805/...),
and for passives its description must contain the schematic value. Prints stock and price so
out-of-stock lines are caught before ordering. Exit 1 on any mismatch.
"""
import csv
import json
import pathlib
import re
import subprocess
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
BOM = HW / "kicad" / "bom-draft.csv"
sys.path.insert(0, str(HW / "tools"))
import jlc_api  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

SIZE = re.compile(r"(0201|0402|0603|0805|1206)")


def norm_value(v):
    """'4.7k' -> ['4.7k','4k7','4.7kΩ'], '100nF' -> ['100nF','100n'], '0.1R' -> ['100mΩ','0.1Ω']."""
    v = v.strip()
    out = {v.lower()}
    m = re.fullmatch(r"([\d.]+)(R|k|M)?", v)
    if m:
        num, unit = m.groups()
        unit = unit or ""
        if unit == "R":
            unit = ""
        out |= {f"{num}{unit}ω".lower(), f"{num}{unit}".lower() + "ω"}
        if num == "0.1" and not unit:
            out |= {"100mω"}
        if num == "0":
            out |= {"0ω"}
    m = re.fullmatch(r"([\d.]+)(u|n|p)(F|H)", v)
    if m:
        num, pre, u = m.groups()
        out |= {f"{num}{pre}{u}".lower(), f"{num}µ{u}".lower() if pre == "u" else ""}
    return {o for o in out if o}


def describe(lcsc):
    body = json.dumps({"keyword": lcsc, "currentPage": 1, "pageSize": 5})
    raw = subprocess.run(["curl", "-s", "-m", "30", "-A", "curl/8.0", "-H", "Content-Type: application/json", "-X", "POST",
                          jlc_api.JLC_SEARCH, "-d", body], capture_output=True).stdout
    for c in json.loads(raw)["data"]["componentPageInfo"]["list"] or []:
        if c["componentCode"] == lcsc:
            return c
    return None


def main():
    bad = 0
    for row in csv.DictReader(BOM.open(encoding="utf-8")):
        lcsc = row["LCSC"]
        if not lcsc:
            continue
        c = describe(lcsc)
        if not c:
            print(f"MISSING  {lcsc:10} {row['Comment']:16} {row['Designator']}")
            bad += 1
            continue
        pkg = c.get("componentSpecificationEn") or ""
        desc = (c.get("describe") or "") + " " + (c.get("componentModelEn") or "")
        issues = []
        fp_size = SIZE.search(row["Footprint"])
        pkg_size = SIZE.search(pkg)
        if fp_size and pkg_size and fp_size.group(1) != pkg_size.group(1):
            issues.append(f"package {pkg} vs footprint {row['Footprint']}")
        if row["Footprint"].startswith(("R_", "C_")) and row["Comment"] not in ("10k B3380",):
            d = desc.lower().replace(" ", "")
            if not any(v in d for v in norm_value(row["Comment"])):
                issues.append(f"value '{row['Comment']}' not in '{desc.strip()[:70]}'")
        p = (c.get("componentPrices") or [{}])[0].get("productPrice")
        status = "OK " if not issues else "BAD"
        bad += bool(issues)
        print(f"{status} {lcsc:10} {row['Comment'][:14]:14} {c['componentModelEn'][:26]:26} {pkg[:18]:18} "
              f"{c['componentLibraryType']:6} stock={c['stockCount']:<8} ${p}  {'; '.join(issues)}")
    print("all LCSC lines match" if not bad else f"{bad} line(s) need attention")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
