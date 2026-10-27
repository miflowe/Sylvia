"use client";
import { useEffect, useState } from "react";
import type { SavedScan } from "@sylvia/core";
import { withDevice } from "@/lib/device";
import styles from "./profile.module.css";

const STATUS = { invasive: "Invasive", native: "Native", introduced: "Not native", unknown: "No record" } as const;
const REGION = { "CA-ON": "Ontario", "CA-BC": "BC" } as Record<string, string>;

export function SavedScans() {
  const [scans, setScans] = useState<SavedScan[] | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    withDevice()
      .then((init) => fetch("/api/scans", init))
      .then(async (r) => (r.ok ? setScans(await r.json()) : Promise.reject()))
      .catch(() => setError("I couldn't load your saved plants. Check your connection and try again."));
  }, []);

  async function remove(id: string) {
    const res = await fetch(`/api/scans/${id}`, await withDevice({ method: "DELETE" }));
    if (res.ok) setScans((s) => s?.filter((x) => x.id !== id));
  }

  return (
    <section className={styles.section} aria-labelledby="my-plants">
      <h2 id="my-plants" className={styles.title}>My plants</h2>
      {error && <p role="alert">{error}</p>}
      {!scans && !error && <p className="muted">Loading…</p>}
      {scans?.length === 0 && (
        <p className="muted">
          Plants you save from Sprout show up here. <a href="/sprout">Scan a plant</a>
        </p>
      )}
      {scans && scans.length > 0 && (
        <ul className={styles.list}>
          {scans.map((s) => (
            <li key={s.id} className={styles.item}>
              {s.hasPhoto ? <Thumb id={s.id} /> : <span className={styles.thumb} aria-hidden="true" />}
              <div className={styles.text}>
                <p className={styles.name}>{s.commonName ?? s.scientificName}</p>
                <p className={`${styles.status} ${styles[`status_${s.status}`]}`}>
                  {STATUS[s.status]} · {REGION[s.regionCode] ?? s.regionCode}
                </p>
                {s.status === "invasive" && s.swaps.length > 0 && (
                  <p className="muted">Swap for {s.swaps.map((w) => w.commonName).join(" or ")}</p>
                )}
                <p className="muted">{new Date(s.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <button type="button" className={styles.remove} onClick={() => remove(s.id)} aria-label={`Remove ${s.commonName ?? s.scientificName}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">Photos are deleted after 30 days. The plant details stay until you remove them.</p>
    </section>
  );
}

/** Photos need the owner's headers, so they're fetched and shown as a local blob URL. */
function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    let url: string | undefined;
    withDevice()
      .then((init) => fetch(`/api/scans/${id}/photo`, init))
      .then(async (r) => {
        if (r.ok) setSrc((url = URL.createObjectURL(await r.blob())));
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={styles.thumb} /> : <span className={styles.thumb} aria-hidden="true" />;
}
