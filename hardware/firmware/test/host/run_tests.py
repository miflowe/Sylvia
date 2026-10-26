"""Build and run the firmware logic tests on the host (no ESP-IDF needed).

    hardware/.venv/Scripts/python -I hardware/firmware/test/host/run_tests.py

Uses the C compiler from the `ziglang` pip package (falls back to gcc/clang/cc on PATH).
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
FW = HERE.parents[1]
BUILD = HERE / "build"
SOURCES = [
    HERE / "test_main.c",
    FW / "components" / "detect" / "detect.c",
    FW / "components" / "power_policy" / "power_policy.c",
    FW / "components" / "payload" / "payload.c",
]
INCLUDES = [FW / "components" / c / "include" for c in ("detect", "power_policy", "payload")]


def compiler():
    try:
        import ziglang  # noqa: F401
        return [sys.executable, "-m", "ziglang", "cc"]
    except ImportError:
        for cc in ("gcc", "clang", "cc"):
            if shutil.which(cc):
                return [cc]
    sys.exit("No C compiler: pip install ziglang (or install gcc/clang).")


def main():
    BUILD.mkdir(exist_ok=True)
    exe = BUILD / ("node_tests.exe" if sys.platform == "win32" else "node_tests")
    cmd = compiler() + ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-o", str(exe)]
    cmd += [f"-I{p}" for p in INCLUDES] + [str(s) for s in SOURCES] + ["-lm"]
    print(" ".join(cmd[-6:]))
    subprocess.run(cmd, check=True)
    r = subprocess.run([str(exe), str(HERE / "fixtures")])
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
