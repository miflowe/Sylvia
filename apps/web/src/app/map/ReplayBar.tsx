"use client";
import { ALERT_LEVELS, verificationLabel, type Alert } from "@sylvia/core";
import { Icon } from "@/components/Icon";
import { HEAT_AGE } from "./TimeBar";
import styles from "./map.module.css";

const clock = (t: number) =>
  new Date(t).toLocaleString("en-CA", { timeZone: "America/Vancouver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

/** Top of the map during a replay: which fire, a clear "not live" label, and the way out. */
export function ReplayHeader({ name, dateLabel, onExit }: { name: string; dateLabel: string; onExit: () => void }) {
  return (
    <div className={styles.replayHead}>
      <p className={styles.replayTag}>
        <span className={styles.replayBadge}>Replay</span>
        <span>{name}, {dateLabel} · not live</span>
      </p>
      <button type="button" className={styles.replayExit} onClick={onExit}>Exit</button>
    </div>
  );
}

/** The most serious alert the live rules would have raised at this moment; it pops in when it first fires. */
export function ReplayAlert({ alerts, open, onToggle }: { alerts: Alert[]; open: boolean; onToggle: () => void }) {
  const top = [...alerts].sort((a, b) => b.level - a.level)[0];
  if (!top) return null;
  const level = ALERT_LEVELS[top.level];
  return (
    <button type="button" key={top.key ?? top.title} className={`${styles.replayAlert} ${styles[`al${top.level}`]}`} onClick={onToggle} aria-expanded={open}>
      <span className={styles.replayAlertEyebrow}>
        Level {top.level} · {top.official ? (top.level === 3 ? "Official order" : "Official alert") : `${level.name} · Unverified`} · Replay
      </span>
      <span className={styles.replayAlertTitle}>{top.title}</span>
      {open && (
        <>
          <span className={styles.replayAlertBody}>{top.body}</span>
          <span className={styles.replayAlertMeta}>{verificationLabel(top)}</span>
        </>
      )}
      {!open && alerts.length > 1 && <span className={styles.replayAlertMeta}>+{alerts.length - 1} more · tap for details</span>}
      {!open && alerts.length === 1 && <span className={styles.replayAlertMeta}>Tap for details</span>}
    </button>
  );
}

/** Bottom bar during a replay: play/pause, the moment in local time, and a slider to scrub through the fire. */
export function ReplayBar(props: { start: number; end: number; t: number; playing: boolean; caption: string; onPlay: () => void; onScrub: (t: number) => void }) {
  const { start, end, t, playing, caption, onPlay, onScrub } = props;
  return (
    <div className={styles.timebar}>
      <div className={styles.replayRow}>
        <button type="button" className={styles.playButton} onClick={onPlay} aria-label={playing ? "Pause replay" : "Play replay"}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
          ) : (
            <Icon name="play" size={20} />
          )}
        </button>
        <div className={styles.replayClock}>
          <span className={styles.replayTime}>{clock(t)}</span>
          {caption && <span className={styles.replayCaption}>{caption}</span>}
        </div>
      </div>
      <input
        className={styles.range}
        type="range"
        min={start}
        max={end}
        step={30 * 60 * 1000}
        value={t}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label="Replay time"
        aria-valuetext={clock(t)}
      />
      <ul className={styles.legend} aria-label="Map key">
        {HEAT_AGE.map((a) => (
          <li key={a.label}>
            <span className={styles.swatch} style={{ background: a.color }} aria-hidden="true" />
            {a.label}
          </li>
        ))}
        <li>
          <span className={styles.swatch} style={{ background: "color-mix(in srgb, var(--ember) 35%, transparent)", outline: "1.5px dashed var(--ember)" }} aria-hidden="true" />
          Estimated fire area
        </li>
      </ul>
    </div>
  );
}
