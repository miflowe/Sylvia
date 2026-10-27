"""Run every hardware check in order; exit 1 if any fails.

    hardware/.venv/Scripts/python -I hardware/tools/verify_all.py [--offline]

--offline skips the checks that need the internet (JLCPCB stock/value lookup).
"""
import pathlib
import subprocess
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
VENV_PY = HW / ".venv" / "Scripts" / "python.exe"
PY = str(VENV_PY if VENV_PY.exists() else sys.executable)

STEPS = [
    ("schematic + ERC", [PY, "-I", str(HW / "kicad" / "sylvia_node.py")], False),
    ("netlist pins have pads", [PY, "-I", str(HW / "tools" / "check_netlist_pads.py")], False),
    ("footprints vs datasheets", [PY, "-I", str(HW / "tools" / "check_footprints.py")], False),
    ("pin map vs board.h", [PY, "-I", str(HW / "tools" / "pin_map.py")], False),
    ("power budget", [PY, "-I", str(HW / "tools" / "power_budget.py")], False),
    ("firmware logic tests", [PY, "-I", str(HW / "firmware" / "test" / "host" / "run_tests.py")], False),
    ("BOM LCSC numbers (online)", [PY, "-I", str(HW / "tools" / "check_bom_lcsc.py")], True),
]


def main():
    offline = "--offline" in sys.argv
    results = []
    for name, cmd, online in STEPS:
        if online and offline:
            results.append((name, "skipped"))
            continue
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        tail = (r.stdout.strip().splitlines() or [""])[-1]
        results.append((name, "PASS" if r.returncode == 0 else "FAIL"))
        print(f"[{'PASS' if r.returncode == 0 else 'FAIL'}] {name}: {tail}")
        if r.returncode != 0:
            print(r.stdout[-2000:], r.stderr[-2000:])
    failed = [n for n, s in results if s == "FAIL"]
    print("\nALL CHECKS PASS" if not failed else f"\nFAILED: {', '.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
