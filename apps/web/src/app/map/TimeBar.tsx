"use client";
import { Icon } from "@/components/Icon";
import styles from "./map.module.css";

/** Colours for satellite heat by age; the map layer and this legend share them. */
export const HEAT_AGE = [
  { upTo: 3, color: "#c2410c", label: "Under 3 h" },
  { upTo: 12, color: "#f08c3a", label: "3–12 h" },
  { upTo: 24, color: "#e8c39e", label: "12–24 h" },
] as const;

const forecastTime = (t: number) => new Date(t).toLocaleString("en-CA", { weekday: "short", hour: "numeric", timeZoneName: "short" });

interface SmokeControl {
  aheadH: number;
  at: number;
  onAhead: (h: number) => void;
}

/**
 * Bottom bar on the map: how many hours of satellite heat to show, the age legend, the smoke forecast hour when that
 * layer is on, and the way into a replay.
 */
export function TimeBar({ hours, onHours, onReplay, smoke }: { hours: number; onHours: (h: number) => void; onReplay: () => void; smoke?: SmokeControl }) {
  return (
    <div className={styles.timebar}>
      {smoke && (
        <div className={styles.smokeBlock}>
          <label className={styles.timeLabel} htmlFor="smoke-ahead">
            Smoke forecast for <b>{forecastTime(smoke.at)}</b>
          </label>
          <input
            id="smoke-ahead"
            className={styles.range}
            type="range"
            min={3}
            max={48}
            step={3}
            value={smoke.aheadH}
            onChange={(e) => smoke.onAhead(Number(e.target.value))}
            aria-valuetext={`${smoke.aheadH} hours from now, ${forecastTime(smoke.at)}`}
          />
          <p className={styles.smokeKey}>
            <span className={styles.smokeRamp} aria-hidden="true" />
            <span>PM2.5 from wildfire smoke: 1 → 30 → 100+ µg/m³ · Environment Canada FireWork</span>
          </p>
        </div>
      )}
      <label className={styles.timeLabel} htmlFor="heat-hours">
        Satellite heat from the last <b>{hours} h</b>
      </label>
      <input
        id="heat-hours"
        className={styles.range}
        type="range"
        min={1}
        max={24}
        step={1}
        value={hours}
        onChange={(e) => onHours(Number(e.target.value))}
        aria-valuetext={`Last ${hours} hours`}
      />
      <ul className={styles.legend} aria-label="Heat age">
        {HEAT_AGE.map((a) => (
          <li key={a.label}>
            <span className={styles.swatch} style={{ background: a.color }} aria-hidden="true" />
            {a.label}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.replayStart} onClick={onReplay}>
        <Icon name="play" size={16} />
        Replay a real past fire
      </button>
    </div>
  );
}
