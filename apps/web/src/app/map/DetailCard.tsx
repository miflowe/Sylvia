"use client";
import { useEffect, useRef } from "react";
import { aqhiCategory, NODE_SOURCE, pm25Label, SOURCES } from "@sylvia/core";
import styles from "./map.module.css";

export type Selected =
  | { kind: "hotspot"; observedAt: string; frp: number | null; satellite: string; confidence: string; fireName?: string; fireStatus?: string; fireAgency?: string; position?: number[] }
  | { kind: "namedFire"; name: string; status: string; areaHa: number | null; agency: string; fireNumber: string; url: string; ofNote?: boolean; updatedAt: string; position?: number[] }
  | { kind: "evac"; noticeKind: "order" | "alert"; areaName: string; agency: string; issuedAt: string; url: string; sourceName: string; position?: number[] }
  | { kind: "fire"; areaHa: number | null; firstSeen: string; lastSeen: string; replay?: boolean; position?: number[] }
  | { kind: "aqhi"; value: number; label: string; observedAt: string; position?: number[] }
  | { kind: "pm25"; value: number; observedAt: string; corrected?: boolean; position?: number[] }
  | { kind: "sighting"; commonName: string; date: string; position?: number[] }
  | { kind: "node"; name: string; value?: number; observedAt: string; simulated?: boolean; co?: number; co2?: number; t?: number; rh?: number; soc?: number; cause?: string; position?: number[] };

const SATELLITES: Record<string, string> = { N20: "NOAA-20", N21: "NOAA-21", N: "Suomi NPP" };
const CONFIDENCE: Record<string, string> = { l: "low", n: "nominal", h: "high" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** Bottom sheet with the details, source and time for whatever was tapped on the map. */
export function DetailCard({ item, onClose }: { item: Selected; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [item, onClose]);

  let title = "";
  let body: React.ReactNode = null;
  let source: { name: string; url: string } = SOURCES.firms;
  switch (item.kind) {
    case "hotspot":
      title = "Heat detected by satellite";
      body = (
        <>
          <dl className={styles.dl}>
            <div><dt>Detected</dt><dd>{when(item.observedAt)}</dd></div>
            {item.satellite && <div><dt>Satellite</dt><dd>{SATELLITES[item.satellite] ?? item.satellite}</dd></div>}
            {item.confidence && <div><dt>Confidence</dt><dd>{CONFIDENCE[item.confidence] ?? item.confidence}</dd></div>}
            {item.frp !== null && <div><dt>Heat output</dt><dd>{item.frp} MW</dd></div>}
            {item.fireName && <div><dt>Likely part of</dt><dd>{item.fireName} ({item.fireStatus?.toLowerCase()}, {item.fireAgency})</dd></div>}
          </dl>
          <p className={styles.note}>
            Not a confirmed fire. Satellites also pick up controlled burns, flares and other heat sources.
            {item.fireName ? " The link to a named fire is by distance only." : ""} Check official sources.
          </p>
        </>
      );
      break;
    case "fire":
      title = item.replay ? "Fire area (replay estimate)" : "Mapped fire area";
      source = item.replay ? SOURCES.firms : SOURCES.cwfis;
      body = (
        <>
          <dl className={styles.dl}>
            {item.areaHa !== null && <div><dt>Area</dt><dd>{Math.round(item.areaHa).toLocaleString("en-CA")} ha</dd></div>}
            {item.firstSeen && <div><dt>First seen</dt><dd>{day(item.firstSeen)}</dd></div>}
            <div><dt>Last active</dt><dd>{day(item.lastSeen)}</dd></div>
          </dl>
          <p className={styles.note}>
            {item.replay
              ? "Sylvia estimated this outline from the satellite heat seen so far in the replay. It is not an official fire perimeter or evacuation zone."
              : "Outline estimated from satellite detections. It is not an official fire perimeter or evacuation zone."}
          </p>
        </>
      );
      break;
    case "namedFire":
      title = item.name;
      source = { name: item.agency, url: item.url };
      body = (
        <>
          <p className={styles.reading}>{item.status}</p>
          <dl className={styles.dl}>
            {item.areaHa !== null && <div><dt>Size</dt><dd>{item.areaHa < 1 ? "Under 1" : Math.round(item.areaHa).toLocaleString("en-CA")} ha</dd></div>}
            <div><dt>Fire number</dt><dd>{item.fireNumber}</dd></div>
            <div><dt>Managed by</dt><dd>{item.agency}</dd></div>
            {item.ofNote && <div><dt>Note</dt><dd>Wildfire of note</dd></div>}
          </dl>
          <p className="muted">Official status from {item.agency}, checked {when(item.updatedAt)}. Sizes are estimates and change through the day.</p>
        </>
      );
      break;
    case "evac":
      title = `Evacuation ${item.noticeKind}: ${item.areaName}`;
      source = { name: item.sourceName, url: item.url };
      body = (
        <>
          <dl className={styles.dl}>
            <div><dt>Issued by</dt><dd>{item.agency}</dd></div>
            <div><dt>Issued</dt><dd>{when(item.issuedAt)}</dd></div>
          </dl>
          <p className={styles.note}>
            {item.noticeKind === "order"
              ? `An official evacuation order covers this area. Follow ${item.agency}'s instructions.`
              : `An official evacuation alert covers this area: be ready to leave on short notice. Follow ${item.agency}'s instructions.`}{" "}
            The outline is relayed as published; check the official source for the exact boundary.
          </p>
        </>
      );
      break;
    case "aqhi": {
      title = item.label || "Air quality station";
      source = SOURCES.aqhi;
      const cat = aqhiCategory(item.value);
      body = (
        <>
          <p className={styles.reading}>AQHI {item.value} · {cat.risk} risk</p>
          <p>{cat.general}</p>
          <p className="muted">Sensitive to smoke: {cat.atRisk}</p>
          <p className="muted">Observed {when(item.observedAt)}</p>
        </>
      );
      break;
    }
    case "pm25":
      title = "Smoke sensor";
      source = SOURCES.purpleair;
      body = (
        <>
          <p className={styles.reading}>PM2.5 {item.value} µg/m³ · {pm25Label(item.value)}</p>
          <p className="muted">
            {item.corrected ? "Corrected with the US EPA formula for PurpleAir sensors. " : ""}Last reported {when(item.observedAt)}. Community sensors aren&apos;t official monitors.
          </p>
        </>
      );
      break;
    case "node":
      title = item.simulated ? `${item.name} (test node)` : item.name;
      source = NODE_SOURCE;
      body = (
        <>
          {item.simulated && <p className={styles.note}>Simulated test data from Sylvia&apos;s cloud test, not a real reading.</p>}
          <p className={styles.reading}>
            {item.value !== undefined ? `PM2.5 ${item.value} µg/m³ · ${pm25Label(item.value)}` : "PM2.5 not reported"}
          </p>
          <dl className={styles.dl}>
            {item.co !== undefined && <div><dt>Carbon monoxide</dt><dd>{item.co} ppm</dd></div>}
            {item.co2 !== undefined && <div><dt>CO2</dt><dd>{item.co2} ppm</dd></div>}
            {item.t !== undefined && <div><dt>Temperature</dt><dd>{item.t} °C, {item.rh ?? "–"}% humidity</dd></div>}
            {item.soc !== undefined && <div><dt>Battery</dt><dd>{item.soc}%</dd></div>}
            {item.cause && item.cause !== "None" && <div><dt>Node flagged</dt><dd>{item.cause} (unverified)</dd></div>}
          </dl>
          <p className="muted">Last reported {when(item.observedAt)}. Location rounded to about 1 km.</p>
        </>
      );
      break;
    case "sighting":
      title = `Reported: ${item.commonName}`;
      source = { name: "Sylvia community sightings", url: "/sprout" };
      body = (
        <>
          <p>Invasive plant reported on {day(item.date)}.</p>
          <p className="muted">Location rounded to about 1 km. Not verified by experts.</p>
        </>
      );
      break;
  }

  return (
    <section ref={ref} tabIndex={-1} className={styles.sheet} aria-label={title}>
      <div className={styles.sheetHead}>
        <h2 className={styles.sheetTitle}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
      </div>
      {body}
      <p className={styles.source}>
        Source: <a href={source.url} target={source.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer">{source.name}</a>
      </p>
    </section>
  );
}
