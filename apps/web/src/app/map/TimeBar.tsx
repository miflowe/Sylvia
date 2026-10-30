"use client";
import { Icon } from "@/components/Icon";
import styles from "./map.module.css";

/** Colours for satellite heat by age; the map layer and this legend share them. */
export const HEAT_AGE = [
  { upTo: 3, color: "#c2410c", label: "Under 3 h" },
  { upTo: 12, color: "#f08c3a", label: "3–12 h" },
  { upTo: 24, color: "#e8c39e", label: "12–24 h" },
] as const;

// CWFIS's FWI classes (the colours its map tiles use).
const FWI_CLASSES = [
  { color: "#2b44ff", label: "0–5 low" },
  { color: "#2fd12f", label: "5–10 moderate" },
  { color: "#ffff2e", label: "10–20 high" },
  { color: "#e0a000", label: "20–30 very high" },
  { color: "#ff2a2a", label: "30+ extreme" },
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
export function TimeBar(props: { hours: number; onHours: (h: number) => void; onReplay: () => void; onReport: () => void; smoke?: SmokeControl; fwi?: boolean }) {
  const { hours, onHours, onReplay, onReport, smoke, fwi } = props;
  return (
    <div className={styles.timebar}>
      {fwi && (
        <div className={styles.smokeBlock}>
          <p className={styles.timeLabel}>Fire Weather Index, today</p>
          <ul className={styles.legend} aria-label="Fire Weather Index classes">
            {FWI_CLASSES.map((c) => (
              <li key={c.label}>
                <span className={styles.swatch} style={{ background: c.color }} aria-hidden="true" />
                {c.label}
              </li>
            ))}
          </ul>
          <p className={styles.smokeKey}>How easily fires start and spread with today&apos;s weather · Natural Resources Canada (CWFIS)</p>
        </div>
      )}
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
      <div className={styles.barActions}>
        <button type="button" className={`${styles.replayStart} ${styles.reportStart}`} onClick={onReport}>
          <Icon name="flame" size={16} />
          Report what you see
        </button>
        <button type="button" className={styles.replayStart} onClick={onReplay}>
          <Icon name="play" size={16} />
          Replay a past fire
        </button>
      </div>
    </div>
  );
}
