"use client";
import { useEffect, useState } from "react";
import { CHECKLIST, MIN_GROUP, SAMPLE_COMMUNITY, type CommunityStats } from "@sylvia/core";
import styles from "./community.module.css";

const itemText = (id: string) => CHECKLIST.find((i) => i.id === id)?.text ?? id;
const show = (n: number | string) => (typeof n === "number" ? n.toLocaleString("en-CA") : n);

export function CommunityView({ id }: { id: string }) {
  const [real, setReal] = useState<CommunityStats | undefined>();
  const [error, setError] = useState("");
  const [sample, setSample] = useState(false);

  useEffect(() => {
    fetch(`/api/communities/${id}`)
      .then(async (r) => (r.ok ? setReal(await r.json()) : setError((await r.json()).error ?? "Couldn't load this community.")))
      .catch(() => setError("Couldn't load this community."));
  }, [id]);

  const s: CommunityStats | undefined = sample ? { ...SAMPLE_COMMUNITY, generatedAt: new Date().toISOString() } : real;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className="eyebrow">Community view · for towns and regional districts</p>
        <h1 className="display">{s?.name ?? "Community"}</h1>
        <p className="muted">
          Anonymous totals from Sylvia users whose home is in this area. Groups smaller than {MIN_GROUP} are hidden so no household can be
          singled out. No names, addresses or exact locations are shown or stored.
        </p>
        <label className={styles.toggle}>
          <input type="checkbox" id="sample-toggle" checked={sample} onChange={() => setSample(!sample)} />
          <span>Show sample data (for demos)</span>
        </label>
      </header>

      {sample && <p className={styles.sampleBanner} role="status">Sample data · made-up numbers to show what this page looks like during a pilot. Not real residents.</p>}
      {!sample && error && <p role="alert">{error}</p>}
      {!s && !error && <p className="muted">Loading…</p>}

      {s && (
        <>
          <section className={styles.card} aria-labelledby="now">
            <h2 id="now" className={styles.title}>Right now</h2>
            <div className={styles.stats}>
              <Stat label="Official fire danger" value={s.now.fireDanger ?? "Not rated"} />
              <Stat label="Air Quality Health Index" value={s.now.aqhi ? `${s.now.aqhi.value} · ${s.now.aqhi.risk}` : "No station"} note={s.now.aqhi?.station} />
              <Stat label="Satellite heat, last 24 h" value={show(s.now.hotspots24h)} note="Unconfirmed detections" />
              <Stat label="Mapped fire areas this season" value={show(s.now.fireAreasThisSeason)} />
              <Stat label="Official evacuation orders" value={show(s.now.officialOrders)} />
              <Stat label="Official evacuation alerts" value={show(s.now.officialAlerts)} />
            </div>
            {s.now.notices.length > 0 && (
              <ul className={styles.list}>
                {s.now.notices.map((n) => (
                  <li key={`${n.kind}-${n.areaName}`}>
                    <b>{n.kind === "order" ? "Order" : "Alert"}:</b> {n.areaName} · {n.agency}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card} aria-labelledby="ready">
            <h2 id="ready" className={styles.title}>How ready residents are</h2>
            <div className={styles.stats}>
              <Stat label="Homes with Sylvia alerts on" value={show(s.readiness.homesWithAlerts)} />
              <Stat label="Homes using the FireSmart checklist" value={show(s.readiness.homesUsingChecklist)} />
              <Stat label="Average checklist completion" value={s.readiness.averageChecklistPercent !== undefined ? `${s.readiness.averageChecklistPercent}%` : "Not enough homes yet"} />
            </div>
            {s.readiness.leastDone.length > 0 && (
              <div className={styles.columns}>
                <div>
                  <h3 className={styles.subtitle}>Most often done</h3>
                  <ol className={styles.list}>{s.readiness.mostDone.map((i) => <li key={i}>{itemText(i)}</li>)}</ol>
                </div>
                <div>
                  <h3 className={styles.subtitle}>Least often done: where outreach helps most</h3>
                  <ol className={styles.list}>{s.readiness.leastDone.map((i) => <li key={i}>{itemText(i)}</li>)}</ol>
                </div>
              </div>
            )}
          </section>

          <section className={styles.card} aria-labelledby="plants">
            <h2 id="plants" className={styles.title}>Invasive plants reported</h2>
            <div className={styles.stats}>
              <Stat label={`Sightings since ${new Date(s.sightings.since).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`} value={show(s.sightings.total)} note="Shared by residents, rounded to about 1 km" />
            </div>
            {s.sightings.bySpecies.length > 0 ? (
              <ol className={styles.list}>
                {s.sightings.bySpecies.map((x) => (
                  <li key={x.name}>{x.name}: {show(x.count)}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">No sightings shared here yet.</p>
            )}
          </section>

          <p className="muted">
            {s.sample ? "Sample data." : `Updated ${new Date(s.generatedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.`} Official data from Natural Resources
            Canada, Environment and Climate Change Canada, NASA FIRMS and BC Emergency Management.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {note && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}
