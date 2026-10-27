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
    FW / "components" / "sensor_math" / "sensor_math.c",
]
INCLUDES = [FW / "components" / c / "include" for c in ("detect", "power_policy", "payload", "sensor_math")]


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
    print(" ".join(cmd[-6:]), flush=True)
    subprocess.run(cmd, check=True)
    syntax_ok = compile_drivers_against_stubs()
    r = subprocess.run([str(exe), str(HERE / "fixtures")])
    sys.exit(r.returncode or (0 if syntax_ok else 1))


def compile_drivers_against_stubs():
    """Type-check the ESP-IDF driver layer + Bosch BME68x API against stubs/ (ESP-IDF v5.4 signatures).
    Catches typos and wrong argument types without ESP-IDF installed. NOT a substitute for `idf.py build`."""
    out = BUILD / "syntax"
    out.mkdir(exist_ok=True)
    comps = FW / "components"
    inc = [HERE / "stubs"] + [comps / c / "include" for c in ("board", "drivers", "sensor_math", "payload", "bme68x")]
    files = sorted((comps / "drivers").glob("*.c")) + [comps / "bme68x" / "bme68x.c"]
    ok = True
    for f in files:
        cmd = compiler() + ["-std=c11", "-c", "-o", str(out / (f.name + ".o")), "-Wall", "-Wextra", "-Werror",
                            "-Wno-unused-parameter"] + [f"-I{p}" for p in inc] + [str(f)]
        ok &= subprocess.run(cmd).returncode == 0
    print(f"driver layer vs ESP-IDF stubs: {len(files)} files {'compile' if ok else 'FAILED'}", flush=True)
    return ok


if __name__ == "__main__":
    main()
