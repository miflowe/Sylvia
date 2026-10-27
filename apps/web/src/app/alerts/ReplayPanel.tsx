"use client";
import { useEffect, useRef, useState } from "react";
import { AlertBanner, type AlertItem } from "@/components/AlertBanner";
import { withDevice } from "@/lib/device";
import styles from "./alerts.module.css";

interface EventSummary {
  id: string;
  name: string;
  dateLabel: string;
  summary: string;
  home: { name: string };
  sources: { name: string; url: string }[];
  frames: { label: string }[];
}

interface StepResult {
  label: string;
  dateOnly: boolean;
  hotspotCount: number;
  alerts: AlertItem[];
  pushed: boolean;
}

/** Replays a real past fire through the same alert rules, clearly labelled, for demos and practice. */
export function ReplayPanel({ onAlerts }: { onAlerts?: () => void }) {
  const [event, setEvent] = useState<EventSummary | undefined>();
  const [runId, setRunId] = useState<string | undefined>();
  const [frame, setFrame] = useState(-1);
  const [step, setStep] = useState<StepResult | undefined>();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch("/api/replay")
      .then((r) => (r.ok ? r.json() : []))
      .then((events: EventSummary[]) => setEvent(events[0]));
  }, []);

  async function runStep(index: number, id = runId) {
    if (!event || !id) return;
    setBusy(true);
    let sensitive = false;
    try {
      sensitive = JSON.parse(localStorage.getItem("sylvia.sensitive") ?? "false");
    } catch {}
    const res = await fetch("/api/replay/step", await withDevice({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: event.id, frame: index, runId: id, sensitive }),
    }));
    setBusy(false);
    if (!res.ok) return setMessage("That replay step didn't run. Try again.");
    setFrame(index);
    setStep(await res.json());
    onAlerts?.();
  }

  function start() {
    const id = crypto.randomUUID();
    setRunId(id);
    setMessage("");
    runStep(0, id);
  }

  const last = event ? event.frames.length - 1 : 0;
  const done = frame >= last;

  useEffect(() => {
    if (!playing || busy) return;
    if (done) return setPlaying(false);
    timer.current = setTimeout(() => runStep(frame + 1), 6000);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, busy, frame, done]);

  async function clear() {
    setPlaying(false);
    const res = await fetch("/api/replay", await withDevice({ method: "DELETE" }));
    const { removed } = res.ok ? await res.json() : { removed: 0 };
    setRunId(undefined);
    setFrame(-1);
    setStep(undefined);
    setMessage(`Removed ${removed} replay alert${removed === 1 ? "" : "s"} from your history.`);
    onAlerts?.();
  }

  if (!event) return null;
  const running = !!runId;

  return (
    <section className={styles.replayCard} aria-labelledby="replay-title">
      <p className="eyebrow">Replay · {event.dateLabel} · Not live data</p>
      <h2 id="replay-title" className={styles.cardTitle}>Replay a real fire: {event.name}</h2>
      <p>{event.summary} See which alerts Sylvia would have sent to a home on {event.home.name.replace(" (replay home)", "")}, using the data available at each moment.</p>

      {!running ? (
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={start}>Start replay</button>
          <button type="button" className={styles.secondary} onClick={clear}>Clear replay alerts</button>
        </div>
      ) : (
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={() => runStep(frame + 1)} disabled={busy || done || playing}>
            {done ? "Replay finished" : busy ? "Running…" : "Next moment"}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setPlaying((p) => !p)} disabled={done}>
            {playing ? "Pause" : "Play automatically"}
          </button>
          <button type="button" className={styles.secondary} onClick={clear}>Reset</button>
        </div>
      )}

      <ol className={styles.timeline} aria-label="Replay timeline">
        {event.frames.map((f, i) => {
          const [time, ...rest] = f.label.split(" · ");
          return (
            <li key={f.label} className={styles.step} aria-current={i === frame ? "step" : undefined}>
              <span className={styles.stepTime}>{time}</span>
              <span>{rest.join(" · ")}</span>
            </li>
          );
        })}
      </ol>

      {step && (
        <div aria-live="polite" className={styles.history}>
          <p className="muted">
            {step.hotspotCount} satellite heat detection{step.hotspotCount === 1 ? "" : "s"} within 25 km in the previous 12 hours.
            {step.alerts.length === 0 ? " No new alerts at this moment." : step.pushed ? " Sent to this device as Replay notifications." : " Turn on alerts to also get these as notifications."}
          </p>
          {step.alerts.map((a) => <AlertBanner key={a.id} alert={a} />)}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <p className="muted">
        Sources: {event.sources.map((s, i) => <span key={s.url}>{i > 0 && "; "}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}. BC publishes evacuation order dates, not times.
      </p>
    </section>
  );
}
