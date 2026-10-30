/**
 * US EPA correction for PurpleAir PM2.5 (Barkjohn et al. 2021, with the high-concentration extension used on the
 * AirNow Fire and Smoke Map). Raw PurpleAir readings run high, and differently in wildfire smoke, so agencies show
 * corrected values. Input is the CF=1 PM2.5 averaged over the sensor's A and B channels, and the sensor's humidity.
 */
export function epaCorrectPm25(cf1: number, rh: number): number {
  const x = cf1;
  let y: number;
  if (x < 30) y = 0.524 * x - 0.0862 * rh + 5.75;
  else if (x < 50) {
    const w = x / 20 - 3 / 2;
    y = (0.786 * w + 0.524 * (1 - w)) * x - 0.0862 * rh + 5.75;
  } else if (x < 210) y = 0.786 * x - 0.0862 * rh + 5.75;
  else if (x < 260) {
    const w = x / 50 - 21 / 5;
    y = (0.69 * w + 0.786 * (1 - w)) * x - 0.0862 * rh * (1 - w) + 2.966 * w + 5.75 * (1 - w) + 8.84e-4 * x * x * w;
  } else y = 2.966 + 0.69 * x + 8.84e-4 * x * x;
  return Math.max(0, Math.round(y * 10) / 10);
}

/**
 * EPA's channel check: drop a reading when the A and B channels disagree by more than 5 µg/m³ and more than 70%,
 * which usually means one laser counter is failing. Returns the averaged CF=1 value, or undefined.
 */
export function agreedCf1(a: number | null | undefined, b: number | null | undefined): number | undefined {
  if (typeof a !== "number" || typeof b !== "number" || a < 0 || b < 0) return undefined;
  const diff = Math.abs(a - b);
  const mean = (a + b) / 2;
  if (diff > 5 && mean > 0 && diff / mean > 0.7) return undefined;
  return mean;
}
