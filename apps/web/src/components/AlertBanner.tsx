import { ALERT_LEVELS, verificationLabel, type Alert } from "@sylvia/core";
import styles from "./AlertBanner.module.css";

export type AlertItem = Alert & { id?: string; createdAt?: string };

const icon = {
  1: <path d="M3 12h4M3 7h8M3 17h6M15 7a3 3 0 106 0 3 3 0 00-6 0zM14 17a4 4 0 108 0 4 4 0 00-8 0z" />,
  2: <path d="M12 3l9 16H3zM12 10v4M12 17h.01" />,
  3: <path d="M10 3h10v18H10M4 12h11M11 8l4 4-4 4" />,
  0: <path d="M5 12l5 5 9-10" />,
} as const;

/** One alert, using the reserved alert scale: level number, word and icon always printed with the colour. */
export function AlertBanner({ alert, now = Date.now() }: { alert: AlertItem; now?: number }) {
  const level = ALERT_LEVELS[alert.level];
  const when = alert.createdAt ? new Date(alert.createdAt) : undefined;
  const mins = when ? Math.round((now - when.getTime()) / 60000) : undefined;
  const ago = mins === undefined ? "" : mins < 60 ? `${Math.max(1, mins)} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : when!.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return (
    <article className={`${styles.banner} ${styles[`l${alert.level}`]}`} role={alert.level >= 2 ? "alert" : undefined}>
      <p className={styles.eyebrow}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon[alert.level]}
        </svg>
        Level {alert.level} · {level.name} · {alert.official ? "Official" : "Unverified"}
        {alert.replay && <span className={styles.replay}>Replay</span>}
      </p>
      <h3 className={styles.title}>{alert.title}</h3>
      <p className={styles.body}>{alert.body}</p>
      <p className={styles.meta}>
        {verificationLabel(alert)}
        {alert.sources.map((s) => ` · ${s.name}`).join("")}
        {ago && ` · ${ago}`}
      </p>
      {alert.url && (
        <a className={styles.link} href={alert.url} target="_blank" rel="noreferrer">
          Open official instructions
        </a>
      )}
    </article>
  );
}
