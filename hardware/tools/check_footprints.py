"""Check Tier B footprints against numbers read from each datasheet's package / land-pattern drawing.

    python -I hardware/tools/check_footprints.py      # writes docs/footprint-check.md, exit 1 on mismatch

Checks: number of pads, pin pitch, exposed pad size (if any), pin 1 position (must be the top-left
pad for ICs in KiCad's convention: smallest x, then smallest y), and pad numbering 1..N present.
The datasheet values in EXPECTED were read by hand from the PDFs in hardware/datasheets/.
"""
import math
import pathlib
import re
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
FP = HW / "kicad" / "lib" / "sylvia.pretty"
OUT = HW / "docs" / "footprint-check.md"

# footprint: (datasheet, signal pads, pitch mm, exposed pad (w, h) or None, source of the numbers)
EXPECTED = {
    "VSON-14_L4.0-W3.0-P0.50-BL-EP_TI_DSJ": ("TPS63020 (DSJ VSON-14 3x4)", 14, 0.5, (1.58, 4.4),
                                             "TPS63020 p.32 thermal pad: 2.85 x 1.58 core + 4x 0.20 fingers to the ends"),
    "WSON-14_L4.0-W4.0-P0.50-BL-EP-1": ("LMP91000 (NHL WSON-14 4x4)", 14, 0.5, (2.6, 3.0),
                                        "LMP91000 p.34 NHL0014B recommended land pattern (EP 3 x 2.6)"),
    "TDFN-8_L2.0-W2.0-P0.50-BL-EP1.2": ("MAX17048G (TDFN-8 2x2)", 8, 0.5, None,
                                        "MAX17048 p.18 cites outline 21-0168 / land 90-0065 (separate ADI docs, "
                                        "not fetched: analog.com unreachable). EP UNVERIFIED"),
    "SOT-23-6_L2.9-W1.6-P0.95-LS2.8-BR": ("TPS22918 (DBV SOT-23-6)", 6, 0.95, None, "TPS22918 datasheet, DBV0006A"),
    "SOT-23-5_L2.9-W1.6-P0.95-LS2.8-BR": ("TPS3840 (DBV SOT-23-5)", 5, 0.95, None, "TPS3840 datasheet, DBV0005A"),
    "SOT-563_L1.6-W1.2-P0.50-LS1.6-BR": ("TPS61023 (DRL SOT-563)", 6, 0.5, None, "TPS61023 datasheet, DRL0006A"),
    "SPEC_110-102_THT": ("SPEC 110-102", 6, 2.0, None, "110-102 datasheet, PCB layout guidelines"),
    "Texas_RVA_VQFN-16-1EP_3.5x3.5mm_P0.5mm_EP2.14x2.14mm_ThermalVias": ("BQ24650 (RVA VQFN-16)", 16, 0.5, (2.14, 2.14),
                                                                         "BQ24650 datasheet, RVA0016A"),
    "VSSOP-10_3x3mm_P0.5mm": ("ADS1115 (DGS VSSOP-10)", 10, 0.5, None, "ADS1115 datasheet, DGS0010A"),
    "Bosch_LGA-8_3x3mm_P0.8mm_ClockwisePinNumbering": ("BME688 (LGA-8 3x3)", 8, 0.8, None, "BME688 datasheet sec. 7 (Bosch numbers clockwise)"),
    "SOT-363_SC-70-6": ("LM66100 (DCK SC-70-6)", 6, 0.65, None, "LM66100 datasheet, DCK0006A"),
    "RAK3172": ("RAK3172 (32-pad stamp)", 32, 1.0, None, "RAK3172 datasheet, pad layout"),
    "ESP32-S3-WROOM-1": ("ESP32-S3-WROOM-1", 41, 1.27, None, "ESP32-S3-WROOM-1 datasheet, PCB land pattern (40 pins + EP group)"),
    "USB_C_Receptacle_HRO_TYPE-C-31-M-12": ("TYPE-C-31-M-12", 16, 0.5, None, "HRO TYPE-C-31-M-12 drawing (A/B pads, A6/B6 + A7/B7 paired)"),
    "JST_GH_SM06B-GHS-TB_1x06-1MP_P1.25mm_Horizontal": ("SM06B-GHS-TB", 6, 1.25, None, "JST GH catalogue"),
}


# Expected numbering direction seen from the top; "-" = not applicable (connectors, modules, 2-row THT).
CW_PARTS = {
    "Bosch_LGA-8_3x3mm_P0.8mm_ClockwisePinNumbering": "cw",
    "SPEC_110-102_THT": "-", "USB_C_Receptacle_HRO_TYPE-C-31-M-12": "-", "RAK3172": "-",
    "ESP32-S3-WROOM-1": "-", "JST_GH_SM06B-GHS-TB_1x06-1MP_P1.25mm_Horizontal": "-",
}


def pads(text):
    out = []
    for m in re.finditer(r'\(pad "?([^"\s]*)"? (\w+) (\w+)\s*\(at ([-\d.]+) ([-\d.]+)[^)]*\)\s*\(size ([\d.]+) ([\d.]+)\)', text):
        num, kind, shape, x, y, w, h = m.groups()
        if shape == "custom":  # polygon pad (e.g. TI DSJ comb thermal pad): use the polygon's bbox
            body = text[m.end(): text.find("(pad ", m.end()) if text.find("(pad ", m.end()) > 0 else len(text)]
            pts = [(float(a), float(b)) for a, b in re.findall(r"\(xy ([-\d.]+) ([-\d.]+)\)", body)]
            if pts:
                w = max(q[0] for q in pts) - min(q[0] for q in pts)
                h = max(q[1] for q in pts) - min(q[1] for q in pts)
        out.append((num, kind, float(x), float(y), float(w), float(h)))
    return out


def analyse(name):
    text = (FP / f"{name}.kicad_mod").read_text(encoding="utf-8")
    p = pads(text)
    numbered = [q for q in p if q[0] not in ("", "MP")]
    nums = sorted({q[0] for q in numbered}, key=lambda s: (len(s), s))
    biggest = max(numbered, key=lambda q: q[4] * q[5]) if numbered else None
    sig = [q for q in numbered if biggest is None or q[4] * q[5] < biggest[4] * biggest[5] * 0.6] or numbered
    # pitch: most common nearest-neighbour distance among signal pads
    dists = []
    for a in sig:
        d = min((math.hypot(a[2] - b[2], a[3] - b[3]) for b in sig
                 if b is not a and math.hypot(a[2] - b[2], a[3] - b[3]) > 0.05), default=0)
        dists.append(round(d, 2))
    pitch = max(set(dists), key=dists.count) if dists else 0
    ep = (biggest[4], biggest[5]) if biggest and biggest[4] * biggest[5] > 0.5 and len(sig) < len(numbered) else None
    pin1 = [q for q in numbered if q[0] in ("1", "A1")]
    # Numbering direction seen from the top: shoelace area of the signal pads in pin order.
    # KiCad's y axis points down, so a negative area means counter-clockwise on screen.
    order = sorted((q for q in sig if q[0].isdigit()), key=lambda q: int(q[0]))
    area = sum(a[2] * b[3] - b[2] * a[3] for a, b in zip(order, order[1:] + order[:1])) / 2
    direction = "ccw" if area < -1e-6 else "cw" if area > 1e-6 else "-"
    return {"pads": len(nums), "pitch": pitch, "ep": ep, "pin1": (pin1[0][2], pin1[0][3]) if pin1 else None,
            "numbers": nums, "dir": direction}


def main():
    rows, bad = [], 0
    for fp, (part, n, pitch, ep, src) in EXPECTED.items():
        a = analyse(fp)
        issues = []
        if a["pads"] < n:
            issues.append(f"{a['pads']} numbered pads, datasheet has {n}")
        if abs(a["pitch"] - pitch) > 0.02:
            issues.append(f"pitch {a['pitch']} vs {pitch}")
        if ep and (not a["ep"] or abs(min(a["ep"]) - min(ep)) > 0.35 or abs(max(a["ep"]) - max(ep)) > 0.45):
            issues.append(f"exposed pad {a['ep']} vs datasheet {ep}")
        if a["pin1"] is None:
            issues.append("no pad 1")
        want = CW_PARTS.get(fp, "ccw")
        if want != "-" and a["dir"] != want:
            issues.append(f"pin numbering runs {a['dir']}, expected {want}")
        status = "OK" if not issues else "CHECK: " + "; ".join(issues)
        bad += bool(issues)
        p1 = f"({a['pin1'][0]:.2f}, {a['pin1'][1]:.2f})" if a["pin1"] else "-"
        rows.append(f"| {part} | `{fp}` | {a['pads']} / {n} | {a['pitch']} / {pitch} | "
                    f"{a['ep'] if a['ep'] else '-'} / {ep if ep else '-'} | {p1} | {a['dir']} | {src} | {status} |")
    OUT.write_text(
        "# Footprint check (generated by `tools/check_footprints.py`)\n\n"
        "Pads / pitch / exposed pad: footprint value / datasheet value. Pin 1 is in footprint coordinates (mm).\n"
        "Automated checks catch count, pitch and EP mistakes. The ECE reviewer still overlays each footprint on its\n"
        "datasheet drawing in the footprint editor (see `review-checklist.md`, section B).\n\n"
        "| Part | Footprint | Pads | Pitch | Exposed pad | Pin 1 at | Datasheet source | Result |\n"
        "|---|---|---|---|---|---|---|---|\n" + "\n".join(rows) + "\n", encoding="utf-8")
    print("\n".join(rows))
    print(f"{len(rows) - bad}/{len(rows)} OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
