"use client";
import { useEffect, useRef, useState } from "react";
import type { SproutCandidate, SproutResult, SproutSwap, SproutVerdict } from "@sylvia/core";
import styles from "./sprout.module.css";

const REGIONS = [
  { code: "CA-ON", name: "Ontario" },
  { code: "CA-BC", name: "BC" },
] as const;
type Region = (typeof REGIONS)[number]["code"];
const regionName = (code: string) => (code === "CA-BC" ? "British Columbia" : "Ontario");

type State =
  | { kind: "idle" }
  | { kind: "checking"; preview: string }
  | { kind: "result"; preview: string; result: SproutResult }
  | { kind: "error"; preview?: string; message: string };

/** Downscale and re-encode as JPEG. Re-encoding through a canvas also drops EXIF, including GPS location. */
async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}

export function SproutScanner() {
  const [region, setRegion] = useState<Region>("CA-ON");
  const [state, setState] = useState<State>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sylvia.region");
      if (saved === "CA-ON" || saved === "CA-BC") setRegion(saved);
    } catch {}
  }, []);
  const chooseRegion = (r: Region) => {
    setRegion(r);
    try {
      localStorage.setItem("sylvia.region", r);
    } catch {}
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setState({ kind: "checking", preview });
    try {
      const form = new FormData();
      form.append("image", await preparePhoto(file), "plant.jpg");
      form.append("region", region);
      const res = await fetch("/api/sprout", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setState({ kind: "result", preview, result: body });
    } catch (e) {
      setState({ kind: "error", preview, message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  async function pick(candidate: SproutCandidate) {
    if (state.kind !== "result") return;
    const { result, preview } = state;
    setState({ kind: "checking", preview });
    try {
      const res = await fetch("/api/sprout/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region: result.regionCode, scientificName: candidate.scientificName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      const others = [result.identification.top, ...result.identification.alternatives].filter(
        (c): c is SproutCandidate => !!c && c.scientificName !== candidate.scientificName,
      );
      setState({
        kind: "result",
        preview,
        result: {
          ...result,
          ...body,
          identification: { ...result.identification, top: candidate, alternatives: others, needsConfirmation: false, level: "high", confirmedByUser: true },
        },
      });
    } catch (e) {
      setState({ kind: "error", preview, message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  const reset = () => {
    setState({ kind: "idle" });
    if (input.current) input.current.value = "";
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className="eyebrow">Sprout</p>
        <h1 className="display">Is this plant safe to keep?</h1>
        <div className={styles.regions} role="radiogroup" aria-label="Your region">
          {REGIONS.map((r) => (
            <button
              key={r.code}
              type="button"
              role="radio"
              aria-checked={region === r.code}
              className={styles.region}
              onClick={() => chooseRegion(r.code)}
              disabled={state.kind === "checking"}
            >
              {r.name}
            </button>
          ))}
        </div>
      </header>

      <input
        ref={input}
        id="sprout-photo"
        className={styles.file}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {state.kind === "idle" && (
        <section className={styles.start}>
          <label htmlFor="sprout-photo" className={styles.primary}>
            <ScanIcon /> Take or choose a photo
          </label>
          <p className="muted">
            Fill the frame with one plant. A clear leaf, flower or fruit works best. I&apos;ll tell you if it&apos;s invasive or
            fire-prone in {regionName(region)}, and what to plant instead.
          </p>
        </section>
      )}

      {state.kind === "checking" && (
        <section className={styles.checking} aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.preview} alt="Your photo" className={styles.photo} />
          <p className={styles.status}>
            <span className={styles.spinner} aria-hidden="true" /> Looking closely at your plant…
          </p>
        </section>
      )}

      {state.kind === "error" && (
        <section className={styles.errorBox} role="alert">
          <p>{state.message}</p>
          <button type="button" className={styles.secondary} onClick={reset}>
            Try another photo
          </button>
        </section>
      )}

      {state.kind === "result" && <Result preview={state.preview} result={state.result} onPick={pick} onReset={reset} />}
    </div>
  );
}

function Result({
  preview,
  result,
  onPick,
  onReset,
}: {
  preview: string;
  result: SproutResult;
  onPick: (c: SproutCandidate) => void;
  onReset: () => void;
}) {
  const { identification: id, verdict } = result;
  if (result.notPlant || !id.top) {
    return (
      <section className={styles.errorBox}>
        <p>{result.notPlant ? "I don't see a plant in that photo." : "I couldn't tell what plant this is."}</p>
        {result.photoTip && <p className="muted">{result.photoTip}</p>}
        <button type="button" className={styles.secondary} onClick={onReset}>
          Try another photo
        </button>
      </section>
    );
  }
  const name = id.top.commonName ?? id.top.scientificName;
  return (
    <div className={styles.result} aria-live="polite">
      <section className={styles.idCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Your photo" className={styles.thumb} />
        <div className={styles.idText}>
          <ConfidenceChip level={id.level} confirmed={!!id.confirmedByUser} />
          <h2 className={styles.plantName}>{name}</h2>
          <p className={styles.sci}>{id.top.scientificName}</p>
        </div>
      </section>

      {id.needsConfirmation && id.alternatives.length > 0 && (
        <section className={styles.confirm}>
          <p className={styles.confirmTitle}>Not sure. Is it one of these instead?</p>
          <div className={styles.altList}>
            {id.alternatives.map((a) => (
              <button key={a.scientificName} type="button" className={styles.alt} onClick={() => onPick(a)}>
                <span>{a.commonName ?? a.scientificName}</span>
                <em>{a.scientificName}</em>
              </button>
            ))}
          </div>
          {result.photoTip && <p className="muted">{result.photoTip}</p>}
        </section>
      )}

      {verdict && <VerdictBlock verdict={verdict} region={regionName(result.regionCode)} />}

      {result.explanation && (
        <section className={styles.sylvia}>
          <p className="eyebrow">Sylvia says</p>
          <p>{result.explanation}</p>
        </section>
      )}

      {result.swaps.length > 0 && (
        <section className={styles.swaps}>
          <h3 className={styles.sectionTitle}>Plant one of these instead</h3>
          {result.swaps.map((s) => (
            <SwapCard key={s.speciesId} swap={s} />
          ))}
        </section>
      )}

      {result.report && (
        <a className={styles.secondary} href={result.report.url} target="_blank" rel="noreferrer">
          {result.report.label}
        </a>
      )}

      <button type="button" className={styles.primaryButton} onClick={onReset}>
        <ScanIcon /> Scan another plant
      </button>
    </div>
  );
}

function ConfidenceChip({ level, confirmed }: { level: "high" | "medium" | "low"; confirmed: boolean }) {
  const label = confirmed ? "You confirmed" : level === "high" ? "Sure" : level === "medium" ? "Fairly sure" : "Not sure";
  return <span className={`${styles.chip} ${styles[`chip_${confirmed ? "high" : level}`]}`}>{label}</span>;
}

function VerdictBlock({ verdict: v, region }: { verdict: SproutVerdict; region: string }) {
  const headline = {
    invasive: `Invasive in ${region}`,
    native: `Native to ${region}`,
    introduced: `Not native to ${region}`,
    unknown: `No record for ${region}`,
  }[v.status];
  return (
    <section className={`${styles.verdict} ${styles[`verdict_${v.status}`]}`}>
      <p className={styles.verdictHead}>
        {v.status === "invasive" ? <InvasiveIcon /> : <LeafIcon />}
        {headline}
      </p>
      {v.status === "introduced" && (
        <p className={styles.verdictBody}>It was brought here from elsewhere. It isn&apos;t on our invasive list for {region}.</p>
      )}
      {v.harm && <p className={styles.verdictBody}>{v.harm}</p>}
      <dl className={styles.facts}>
        <div>
          <dt>Fire</dt>
          <dd>{v.flammability}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {v.source.url ? (
              <a href={v.source.url} target="_blank" rel="noreferrer">
                {v.source.name}
              </a>
            ) : (
              v.source.name
            )}
            {v.confidence === "lower" && " · lower confidence"}
          </dd>
        </div>
      </dl>
      {!v.reviewed && <p className={styles.draft}>Not yet reviewed by our team</p>}
    </section>
  );
}

function SwapCard({ swap: s }: { swap: SproutSwap }) {
  return (
    <article className={styles.swap}>
      <p className={styles.swapKind}>{s.kind === "curated" ? "Recommended swap" : "Looks similar"}</p>
      <h4 className={styles.swapName}>{s.commonName}</h4>
      <p className={styles.sci}>{s.scientificName}</p>
      {s.why && <p>{s.why}</p>}
      <p className="muted">{s.flammability}</p>
      {!s.reviewed && <p className={styles.draft}>Not yet reviewed</p>}
    </article>
  );
}

const svg = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const ScanIcon = () => (
  <svg {...svg}>
    <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
    <path d="M12 16V10M12 10c0-2.5 2-4 5-4 0 2.5-2 4-5 4zM12 13c0-2-1.6-3.2-4-3.2 0 2 1.6 3.2 4 3.2z" />
  </svg>
);
const LeafIcon = () => (
  <svg {...svg}>
    <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" />
  </svg>
);
const InvasiveIcon = () => (
  <svg {...svg}>
    <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" />
    <path d="M14 14l5 5M19 14l-5 5" />
  </svg>
);
