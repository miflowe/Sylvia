"""Fetch datasheets into a staging folder, verify them, and write parts/datasheets.csv.

    python -I hardware/tools/fetch_datasheets.py stage     # download into _staging/batch1/datasheets
    python -I hardware/tools/fetch_datasheets.py promote   # move verified PDFs into datasheets/

Datasheets are copyrighted, so datasheets/ is gitignored; parts/datasheets.csv (URL + sha256) is
committed so anyone can re-fetch and check them. Only run "stage" for a batch the user approved.
"""
import csv
import datetime as dt
import hashlib
import pathlib
import re
import shutil
import subprocess
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HW / "tools"))
import jlc_api  # noqa: E402
from build_parts import safe_name  # noqa: E402

STAGE = HW / "_staging" / "batch1" / "datasheets"
FINAL = HW / "datasheets"
MANIFEST = HW / "parts" / "datasheets.csv"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# Extra documents that are not a parts.csv row, or whose parts.csv URL is an HTML page.
EXTRA = [
    ("ESP32-S3_chip", "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf"),
    ("RAK3172-9-SM-I", "lcsc:C19723905"),
    ("nRF9151-LACA-R7", "lcsc:C22397843"),
    ("1042", "lcsc:C5249310"),
]
SKIP = {"CO-B4"}  # quote-only part, no public datasheet
GENERIC = ("CL05", "CL10", "CL21", "0402WGF", "0603WAF")  # passives: no PDF needed


def curl(url, dest, ua):
    r = subprocess.run(["curl", "-s", "-L", "-m", "120", "-A", ua, "-o", str(dest), "-w", "%{http_code}", url],
                       capture_output=True, text=True)
    return r.stdout.strip()


def resolve_lcsc(url):
    """LCSC datasheet links return an HTML viewer; the real PDF is on datasheet.lcsc.com."""
    html = subprocess.run(["curl", "-s", "-L", "-m", "60", "-A", "curl/8.0", url], capture_output=True,
                          text=True, errors="replace").stdout
    m = re.search(r"https://datasheet\.lcsc\.com/datasheet/pdf/[0-9a-f]+\.pdf\?productCode=C\d+", html)
    return m.group(0) if m else None


def lcsc_numbers():
    rows = csv.DictReader((HW / "parts" / "parts.csv").open(encoding="utf-8"))
    return {r["mpn"]: r["lcsc"] for r in rows if r["lcsc"]}


def lcsc_copy(lcsc):
    """Resolve the PDF behind LCSC's datasheet viewer for an LCSC part number."""
    snap = jlc_api.lookup(lcsc)
    url = snap["datasheet"] if snap else ""
    if url and "datasheet.lcsc.com/datasheet/pdf" not in url:
        url = resolve_lcsc(url) or ""
        if not url:
            html = subprocess.run(["curl", "-s", "-L", "-m", "60", "-A", "curl/8.0",
                                   f"https://www.lcsc.com/product-detail/{lcsc}.html"],
                                  capture_output=True, text=True, errors="replace").stdout
            m = re.search(r"https://datasheet\.lcsc\.com/datasheet/pdf/[0-9a-f]+\.pdf\?productCode=" + lcsc, html)
            url = m.group(0) if m else ""
    return url


def targets():
    rows = list(csv.DictReader((HW / "parts" / "parts.csv").open(encoding="utf-8")))
    out = {}
    for r in rows:
        mpn, url = r["mpn"], r["datasheet_url"]
        if mpn in SKIP or mpn.startswith(GENERIC) or not url:
            continue
        if not url.lower().split("?")[0].endswith(".pdf"):
            continue  # HTML product pages: covered by EXTRA or skipped
        out[mpn] = url
    for mpn, url in EXTRA:
        out[mpn] = url
    return out


def pdf_info(path):
    data = path.read_bytes()
    if not data.startswith(b"%PDF"):
        return None
    try:
        import pymupdf
        pages = pymupdf.open(path).page_count
    except Exception:
        pages = "?"
    return {"bytes": len(data), "pages": pages, "sha256": hashlib.sha256(data).hexdigest()}


def stage():
    STAGE.mkdir(parents=True, exist_ok=True)
    report = []
    for mpn, url in targets().items():
        src = url
        if url.startswith("lcsc:"):
            snap = jlc_api.lookup(url[5:])
            src = snap["datasheet"] if snap else ""
        if "lcsc.com" in src and "datasheet.lcsc.com/datasheet/pdf" not in src:
            src = resolve_lcsc(src) or src
        dest = STAGE / (safe_name(mpn) + ".pdf")
        if dest.exists() and pdf_info(dest):
            report.append((mpn, "cached", src, pdf_info(dest)))
            continue
        ua = "curl/8.0" if "lcsc.com" in src else BROWSER_UA
        code = curl(src, dest, ua) if src else "no-url"
        info = pdf_info(dest) if dest.exists() else None
        lcsc = lcsc_numbers().get(mpn)
        if not info and lcsc:
            # Manufacturer site unreachable (analog.com and st.com refuse scripts): use LCSC's copy.
            src = lcsc_copy(lcsc)
            code = curl(src, dest, "curl/8.0") if src else "no-lcsc"
            info = pdf_info(dest) if dest.exists() else None
        if not info and dest.exists():
            dest.rename(dest.with_suffix(".rejected"))
        report.append((mpn, code, src, info))
    for mpn, code, src, info in report:
        status = f"{info['pages']} p, {info['bytes'] // 1024} KB" if info else "NOT A PDF"
        print(f"{mpn:28} {code:7} {status:20} {src}")


def promote():
    FINAL.mkdir(exist_ok=True)
    today = dt.date.today().isoformat()
    srcs = {safe_name(m): u for m, u in targets().items()}
    old = {}
    if MANIFEST.exists():
        old = {r["file"]: r for r in csv.DictReader(MANIFEST.open(encoding="utf-8"))}
    for f in sorted(STAGE.glob("*.pdf")):
        info = pdf_info(f)
        if not info:
            continue
        shutil.move(str(f), FINAL / f.name)
        old[f.name] = {"file": f.name, "source_url": srcs.get(f.stem, ""), "sha256": info["sha256"],
                       "bytes": info["bytes"], "pages": info["pages"], "fetched": today}
    with MANIFEST.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["file", "source_url", "sha256", "bytes", "pages", "fetched"])
        w.writeheader()
        w.writerows(sorted(old.values(), key=lambda r: r["file"].lower()))
    print(f"{len(old)} datasheets in manifest -> {MANIFEST}")


if __name__ == "__main__":
    {"stage": stage, "promote": promote}[sys.argv[1]]()
