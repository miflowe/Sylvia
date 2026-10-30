"use client";
import { useState } from "react";
import { FIRE_LINES, REPORT_KINDS, REPORT_NOTE_MAX, type ReportKind } from "@sylvia/core";
import { Sheet } from "@/components/Sheet";
import { withDevice } from "@/lib/device";
import { preparePhoto } from "@/lib/photo";
import styles from "./map.module.css";

const TEL: Record<string, string> = { "911": "tel:911", "*5555 on a cell, or 1-800-663-5555": "tel:18006635555", "310-FIRE (310-3473)": "tel:3103473" };

/**
 * "Report what you see": emergency numbers first, then what (smoke, flames, ash, glow), where (rounded to ~1 km),
 * an optional note and photo. Reports show on the map for 6 hours as unverified.
 */
export function ReportSheet({ open, onClose, mapCentre, onSent }: { open: boolean; onClose: () => void; mapCentre: () => { lat: number; lon: number } | undefined; onSent: () => void }) {
  const [kind, setKind] = useState<ReportKind | undefined>();
  const [where, setWhere] = useState<"here" | "map">("map");
  const [here, setHere] = useState<{ lat: number; lon: number } | undefined>();
  const [locating, setLocating] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Blob | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function reset() {
    setKind(undefined);
    setNote("");
    setPhoto(undefined);
    setError("");
    setSent(false);
  }

  function useMyLocation() {
    setWhere("here");
    if (here) return;
    setLocating("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLocating("");
      },
      () => {
        setWhere("map");
        setLocating("Location is off, so the centre of the map will be used. Move the map to where you saw it.");
      },
      { timeout: 10000, maximumAge: 120000 },
    );
  }

  async function send() {
    if (!kind) return setError("Choose what you see.");
    const at = where === "here" ? here : mapCentre();
    if (!at) return setError("Choose where you saw it.");
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("lat", String(at.lat));
    form.set("lon", String(at.lon));
    if (note.trim()) form.set("note", note.trim());
    if (photo) form.set("photo", photo, "report.jpg");
    try {
      const res = await fetch("/api/reports", await withDevice({ method: "POST", body: form }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error);
      setSent(true);
      onSent();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't send that report. If you see flames, call 911.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={sent ? "Report sent" : "Report what you see"}
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
    >
      {sent ? (
        <>
          <p>Thanks. Your report is on the map for the next 6 hours, marked as an unverified resident report.</p>
          <p className="muted">If you see flames or anyone is in danger, call 911.</p>
          <button type="button" className="btn btnPrimary" onClick={() => { onClose(); reset(); }}>
            Done
          </button>
        </>
      ) : (
        <>
          <div className={styles.emergency} role="note">
            <p className={styles.emergencyTitle}>If you see flames, call 911.</p>
            <ul>
              {FIRE_LINES.slice(1).map((l) => (
                <li key={l.region}>
                  {l.label}: <a href={TEL[l.number]}>{l.number}</a>
                </li>
              ))}
            </ul>
            <p className="muted">Sylvia shares reports with neighbours. It doesn&apos;t alert fire crews.</p>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legendTitle}>What do you see?</legend>
            <div className={styles.kinds}>
              {REPORT_KINDS.map((k) => (
                <label key={k.kind} className={styles.kind} data-on={kind === k.kind}>
                  <input type="radio" name="report-kind" value={k.kind} checked={kind === k.kind} onChange={() => { setKind(k.kind); setError(""); }} />
                  <span className={styles.kindLabel}>{k.label}</span>
                  <span className={styles.kindHint}>{k.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legendTitle}>Where?</legend>
            <div className="segmented" role="radiogroup" aria-label="Where you saw it">
              <button type="button" role="radio" aria-checked={where === "map"} onClick={() => setWhere("map")}>
                Centre of the map
              </button>
              <button type="button" role="radio" aria-checked={where === "here"} onClick={useMyLocation}>
                Where I am
              </button>
            </div>
            <p className="muted">{locating || "Rounded to about 1 km before it's shared."}</p>
          </fieldset>

          <label className={styles.fieldset}>
            <span className={styles.legendTitle}>Anything to add? (optional)</span>
            <textarea
              className={styles.textarea}
              value={note}
              maxLength={REPORT_NOTE_MAX}
              rows={2}
              placeholder="Thick smoke to the north-west"
              onChange={(e) => setNote(e.target.value)}
            />
            <span className="muted">{REPORT_NOTE_MAX - note.length} characters left</span>
          </label>

          <label className={styles.fieldset}>
            <span className={styles.legendTitle}>Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setPhoto(file ? await preparePhoto(file, 1024).catch(() => undefined) : undefined);
              }}
            />
            <span className="muted">Location data is removed from the photo. Don&apos;t include people&apos;s faces or licence plates.</span>
          </label>

          {error && <p className={styles.formError} role="alert">{error}</p>}
          <button type="button" className="btn btnPrimary" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </button>
          <p className="muted">Shown on the map for 6 hours as an unverified resident report. Never report while driving.</p>
        </>
      )}
    </Sheet>
  );
}
