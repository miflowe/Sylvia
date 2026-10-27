"use client";
import { useState } from "react";
import type { NearbyNursery, SproutResult } from "@sylvia/core";
import { getLocation, withDevice } from "@/lib/device";
import styles from "./sprout.module.css";

type Status = "idle" | "busy" | "done" | "error";

export function SaveScan({ result, photo }: { result: SproutResult; photo?: Blob }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const top = result.identification.top!;
  const v = result.verdict;

  async function save() {
    setStatus("busy");
    try {
      const form = new FormData();
      form.append(
        "scan",
        JSON.stringify({
          regionCode: result.regionCode,
          scientificName: top.scientificName,
          commonName: top.commonName,
          speciesId: v?.speciesId,
          status: v?.status ?? "unknown",
          flammability: v?.flammability ?? "Flammability not rated",
          swaps: result.swaps.slice(0, 5).map((s) => ({ speciesId: s.speciesId, commonName: s.commonName })),
        }),
      );
      if (photo) form.append("image", photo, "plant.jpg");
      const res = await fetch("/api/scans", await withDevice({ method: "POST", body: form }));
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save.");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setStatus("error");
    }
  }

  return (
    <div className={styles.saveRow}>
      <button type="button" className="btn btnPrimary btnBlock" onClick={save} disabled={status === "busy" || status === "done"}>
        {status === "done" ? "Saved to My plants" : status === "busy" ? "Saving…" : "Save to My plants"}
      </button>
      {status === "done" && <a href="/profile">See My plants</a>}
      {status === "error" && <span role="alert" className={styles.inlineError}>{error}</span>}
    </div>
  );
}

export function ShareSighting({ result }: { result: SproutResult }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function share() {
    setStatus("busy");
    try {
      const at = await getLocation();
      const res = await fetch("/api/sightings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionCode: result.regionCode, scientificName: result.identification.top!.scientificName, ...at, consent: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't share the sighting.");
      setStatus("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't share the sighting.");
      setStatus("error");
    }
  }

  return (
    <section className={styles.optIn}>
      <h3 className="sectionTitle">Help map invasive plants</h3>
      <p>
        Add this sighting to Sylvia&apos;s &quot;reported nearby&quot; map. I&apos;ll store the plant, the date and your location
        rounded to about 1 km. Nothing links it to you or this device.
      </p>
      {status === "done" ? (
        <p className={styles.okNote}>Thanks. Your sighting is on the map.</p>
      ) : (
        <button type="button" className="btn btnOutline" onClick={share} disabled={status === "busy"}>
          {status === "busy" ? "Sharing…" : "Share this sighting"}
        </button>
      )}
      {status === "error" && <p role="alert" className={styles.inlineError}>{message}</p>}
      {result.report && (
        <p className="muted">
          To report it to the experts too:{" "}
          <a href={result.report.url} target="_blank" rel="noreferrer">
            {result.report.label}
          </a>
        </p>
      )}
    </section>
  );
}

const PROGRAM_LABEL = { "grow-me-instead": "Grow Me Instead", "firesmart-bc": "FireSmart BC" } as const;

export function NearbyNurseries({ regionCode }: { regionCode: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [list, setList] = useState<NearbyNursery[]>([]);
  const [message, setMessage] = useState("");

  async function find() {
    setStatus("busy");
    try {
      const at = await getLocation();
      const res = await fetch(`/api/nurseries?lat=${at.lat.toFixed(4)}&lon=${at.lon.toFixed(4)}&region=${regionCode}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't search.");
      setList(body);
      setStatus("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't search.");
      setStatus("error");
    }
  }

  return (
    <section className={styles.nurseries}>
      <h3 className="sectionTitle">Where to buy</h3>
      {status !== "done" && (
        <button type="button" className="btn btnOutline" onClick={find} disabled={status === "busy"}>
          {status === "busy" ? "Searching…" : "Find garden centres near me"}
        </button>
      )}
      {status === "error" && <p role="alert" className={styles.inlineError}>{message}</p>}
      {status === "done" && list.length === 0 && <p className="muted">I didn&apos;t find garden centres within 30 km.</p>}
      {list.length > 0 && (
        <>
          <ul className={styles.nurseryList}>
            {list.map((n) => (
              <li key={`${n.name}-${n.location.lat}`} className={styles.nursery}>
                <div className={styles.nurseryTop}>
                  <span className={styles.nurseryName}>{n.name}</span>
                  <span className={styles.distance}>{n.distanceKm} km</span>
                </div>
                {n.programs.length > 0 && (
                  <p className={styles.badges}>
                    {n.programs.map((p) => (
                      <span key={p} className={styles.badge}>{PROGRAM_LABEL[p]}</span>
                    ))}
                  </p>
                )}
                {n.address && <p className="muted">{n.address}</p>}
                <a
                  href={`https://www.bing.com/maps?rtp=~pos.${n.location.lat}_${n.location.lon}_${encodeURIComponent(n.name)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                </a>
              </li>
            ))}
          </ul>
          <p className="muted">Call ahead to ask if they carry native plants. Sylvia doesn&apos;t know what&apos;s in stock. Results from Azure Maps.</p>
        </>
      )}
    </section>
  );
}
