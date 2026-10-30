"use client";
import { Icon } from "@/components/Icon";
import styles from "./map.module.css";

/** Colours for satellite heat by age; the map layer and this legend share them. */
export const HEAT_AGE = [
  { upTo: 3, color: "#c2410c", label: "Under 3 h" },
  { upTo: 12, color: "#f08c3a", label: "3–12 h" },
  { upTo: 24, color: "#e8c39e", label: "12–24 h" },
] as const;

/** Bottom bar on the map: how many hours of satellite heat to show, the age legend, and the way into a replay. */
export function TimeBar({ hours, onHours, onReplay }: { hours: number; onHours: (h: number) => void; onReplay: () => void }) {
  return (
    <div className={styles.timebar}>
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
