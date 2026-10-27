"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedScan } from "@sylvia/core";
import { Icon } from "@/components/Icon";
import { ScanThumb } from "@/components/ScanThumb";
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
      <h2 id="my-plants" className="sectionTitle">My plants</h2>
      {error && <p role="alert" className="card">{error}</p>}
      {!scans && !error && <p className="muted">Loading…</p>}
      {scans?.length === 0 && (
        <Link href="/sprout" className={styles.empty}>
          <span className="listIcon"><Icon name="camera" size={20} /></span>
          <span className="listText">
            <span className="listTitle">Scan your first plant</span>
            <span className="listSub">Plants you save from Sprout show up here</span>
          </span>
          <Icon name="chevronRight" size={20} className="chevron" />
        </Link>
      )}
      {scans && scans.length > 0 && (
        <ul className="list">
          {scans.map((s) => (
            <li key={s.id} className={`listRow ${styles.plant}`}>
              <ScanThumb id={s.id} hasPhoto={s.hasPhoto} className={styles.thumb} />
              <div className="listText">
                <p className={styles.name}>{s.commonName ?? s.scientificName}</p>
                <p className={`${styles.status} ${styles[`status_${s.status}`]}`}>
                  {STATUS[s.status]} · {REGION[s.regionCode] ?? s.regionCode}
                </p>
                {s.status === "invasive" && s.swaps.length > 0 && (
                  <p className="listSub">Swap for {s.swaps.map((w) => w.commonName).join(" or ")}</p>
                )}
                <p className="listSub">{new Date(s.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <button type="button" className={styles.remove} onClick={() => remove(s.id)} aria-label={`Remove ${s.commonName ?? s.scientificName}`}>
                <Icon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>Photos are deleted after 30 days. The plant details stay until you remove them.</p>
    </section>
  );
}
