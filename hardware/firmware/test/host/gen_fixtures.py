"""Generate simulated ground-truth air readings (one row per 60 s wake) for the detector tests.

    python -I hardware/firmware/test/host/gen_fixtures.py

Deterministic (fixed seed), so the committed CSVs only change when this script does.
Columns: t_s, pm25 (ug/m3), co2 (ppm), co (ppm), gas_kohm, temp_c, rh. Empty = sensor reading invalid.
The test harness decides when the SEN66 (pm25, co2) is actually sampled, via the power policy.

Shapes are plausible, not measured: they exercise the logic. Replace/extend with real logged
traces once Nodes are deployed.
"""
import csv
import math
import pathlib
import random

OUT = pathlib.Path(__file__).parent / "fixtures"


def ramp(t, t0, t1, a, b):
    if t <= t0:
        return a
    if t >= t1:
        return b
    return a + (b - a) * (t - t0) / (t1 - t0)


def rise(t, t0, tau, a, b):
    """First-order rise from a to b starting at t0 (seconds)."""
    return a if t < t0 else b + (a - b) * math.exp(-(t - t0) / tau)


def write(name, rows):
    OUT.mkdir(exist_ok=True)
    with (OUT / f"{name}.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t_s", "pm25", "co2", "co", "gas_kohm", "temp_c", "rh"])
        for r in rows:
            w.writerow(["" if v is None else (round(v, 3) if isinstance(v, float) else v) for v in r])


def base(rng, t, temp=18.0, rh=55.0):
    return [t, max(0.0, rng.gauss(6.0, 1.5)), rng.gauss(425, 8), max(0.0, rng.gauss(0.3, 0.1)),
            rng.gauss(120, 3), rng.gauss(temp, 0.3), min(100.0, rng.gauss(rh, 1.5))]


def clean(rng):
    return [base(rng, i * 60) for i in range(8 * 60)]


def regional(rng):
    rows = []
    for i in range(12 * 60):
        t = i * 60
        r = base(rng, t)
        r[1] = max(0.0, ramp(t, 2 * 3600, 8 * 3600, 6, 140) * rng.gauss(1, 0.08))
        r[3] = max(0.0, ramp(t, 2 * 3600, 8 * 3600, 0.3, 1.2) + rng.gauss(0, 0.1))
        r[4] = ramp(t, 2 * 3600, 8 * 3600, 120, 108) + rng.gauss(0, 3)
        rows.append(r)
    return rows


def smoulder(rng, temp=18.0):
    onset = 120 * 60
    rows = []
    for i in range(6 * 60):
        t = i * 60
        r = base(rng, t, temp=temp)
        r[1] = max(0.0, rise(t, onset, 600, 7, 220) * rng.gauss(1, 0.06))
        r[2] = rise(t, onset, 600, 425, 575) + rng.gauss(0, 8)
        r[3] = max(0.0, rise(t, onset, 600, 0.3, 18) + rng.gauss(0, 0.2))
        r[4] = rise(t, onset, 600, 120, 60) + rng.gauss(0, 3)
        rows.append(r)
    return rows


def bbq_propane(rng):
    rows = []
    for i in range(6 * 60):
        t = i * 60
        r = base(rng, t, temp=22.0)
        on = 120 * 60 <= t < 180 * 60
        plume = rng.uniform(0.6, 1.0) if on else 0.0
        r[1] = max(0.0, r[1] + 32 * plume)
        r[2] = r[2] + 250 * plume
        r[3] = max(0.0, r[3] + 1.5 * plume)
        r[4] = r[4] * (1 - 0.10 * plume)
        rows.append(r)
    return rows


def fog(rng):
    rows = []
    for i in range(6 * 60):
        t = i * 60
        r = base(rng, t, temp=6.0, rh=80.0)
        if 60 * 60 <= t < 240 * 60:
            r[6] = min(100.0, rng.uniform(97, 99.5))
            r[1] = max(0.0, ramp(t, 60 * 60, 150 * 60, 5, 70) * rng.gauss(1, 0.1))
        rows.append(r)
    return rows


def dropouts(rng):
    rows = clean(rng)
    for r in rows:
        if rng.random() < 0.2:
            r[3] = None
        if rng.random() < 0.2:
            r[4] = None
        if rng.random() < 0.1:
            r[1] = None
            r[2] = None
    return rows


def main():
    rng = random.Random(20261025)
    write("clean", clean(rng))
    write("regional", regional(rng))
    write("smoulder", smoulder(rng))
    write("bbq_propane", bbq_propane(rng))
    write("fog", fog(rng))
    write("dropouts", dropouts(rng))
    write("smoulder_cold", smoulder(rng, temp=-20.0))
    print("fixtures written to", OUT)


if __name__ == "__main__":
    main()
