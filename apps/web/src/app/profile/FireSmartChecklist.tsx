"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHECKLIST, checklistProgress, FIRESMART_SOURCE, ZONES, type ChecklistItem, type Place } from "@sylvia/core";
import { Icon } from "@/components/Icon";
import { withDevice } from "@/lib/device";
import styles from "./profile.module.css";

const zones = Object.keys(ZONES) as ChecklistItem["zone"][];

export function FireSmartChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    withDevice()
      .then((init) => fetch("/api/checklist", init))
      .then((r) => (r.ok ? r.json() : { done: {} }))
      .then((b: { done: Record<string, boolean> }) => {
        setDone(b.done);
        setLoaded(true);
      });
  }, []);

  function toggle(id: string) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    setSaved("");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      let home: Place | undefined;
      try {
        home = JSON.parse(localStorage.getItem("sylvia.place") ?? "null") ?? undefined;
      } catch {}
      const res = await fetch("/api/checklist", await withDevice({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done: next, home: home && { lat: home.lat, lon: home.lon } }),
      }));
      setSaved(res.ok ? "Saved" : "Couldn't save. Check your connection.");
    }, 600);
  }

  const p = checklistProgress(done);
  return (
    <section className={styles.section} aria-labelledby="firesmart">
      <h2 id="firesmart" className="sectionTitle">FireSmart checklist</h2>
      <div className={styles.progressCard}>
        <div className={styles.progressTop}>
          <span className={styles.progressBig}>{p.percent}%</span>
          <span className={styles.progressText} aria-live="polite">{p.done} of {p.total} done{saved && ` · ${saved}`}</span>
        </div>
        <div className={styles.progress} role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
          <span style={{ width: `${p.percent}%` }} />
        </div>
        <p className={styles.progressNote}>
          Small steps around your home make it much harder for embers to start a fire. Based on{" "}
          <a href={FIRESMART_SOURCE.url} target="_blank" rel="noreferrer">{FIRESMART_SOURCE.name}</a> guidance.
        </p>
      </div>
      {!loaded && <p className="muted">Loading…</p>}
      {/* One collapsed row per zone with its progress; open a zone to see and tick its steps. */}
      {loaded &&
        zones.map((zone) => {
          const items = CHECKLIST.filter((i) => i.zone === zone);
          const zoneDone = items.filter((i) => done[i.id]).length;
          return (
            <details key={zone} className={styles.zone}>
              <summary className={styles.zoneSummary}>
                <span className={styles.zoneName}>{ZONES[zone]}</span>
                <span className={styles.zoneCount} data-complete={zoneDone === items.length}>
                  {zoneDone === items.length ? "All done" : `${zoneDone} of ${items.length} done`}
                </span>
                <Icon name="chevronDown" size={20} className={styles.zoneChevron} />
              </summary>
              <div role="group" aria-label={ZONES[zone]}>
                {items.map((item) => (
                  <div key={item.id} className={styles.check}>
                    <input type="checkbox" id={`chk-${item.id}`} checked={!!done[item.id]} onChange={() => toggle(item.id)} />
                    <label htmlFor={`chk-${item.id}`}>
                      <span className={styles.checkText}>{item.text}</span>
                      <span className={styles.why}>{item.why}</span>
                    </label>
                    {item.link && <Link className={styles.checkLink} href={item.link.href}>{item.link.label}</Link>}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
    </section>
  );
}
