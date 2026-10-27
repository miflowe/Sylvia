"use client";
import { useCallback, useEffect, useState } from "react";
import { FIRE_DANGER, type Conditions, type Place } from "@sylvia/core";
import { syncAlerts } from "@/lib/alerts";
import { getLocation } from "@/lib/device";
import styles from "./home.module.css";

const PLACE_KEY = "sylvia.place";
const SENSITIVE_KEY = "sylvia.sensitive";

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const rtf = new Intl.RelativeTimeFormat("en-CA", { numeric: "auto" });
function ago(iso?: string): string {
  if (!iso) return "";
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function HomeDashboard() {
  const [place, setPlace] = useState<Place | undefined>();
  const [ready, setReady] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [conditions, setConditions] = useState<Conditions | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlace(load<Place>(PLACE_KEY));
    setSensitive(load<boolean>(SENSITIVE_KEY) ?? false);
    setReady(true);
  }, []);

  const refresh = useCallback(async (p: Place, s: boolean) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ lat: String(p.lat), lon: String(p.lon), name: p.name, sensitive: s ? "1" : "0" });
      if (p.regionCode) q.set("region", p.regionCode);
      const res = await fetch(`/api/conditions?${q}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load conditions.");
      setConditions(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load conditions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (place) refresh(place, sensitive);
  }, [place, sensitive, refresh]);

  const choose = (p: Place) => {
    save(PLACE_KEY, p);
    setConditions(undefined);
    setPlace(p);
    syncAlerts(p, sensitive).catch(() => {});
  };
  const toggleSensitive = () => {
    save(SENSITIVE_KEY, !sensitive);
    setSensitive(!sensitive);
    if (place) syncAlerts(place, !sensitive).catch(() => {});
  };

  if (!ready) return null;
  if (!place) return <PlacePicker onChoose={choose} />;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className="eyebrow">Home</p>
        <h1 className="display">{place.name}</h1>
        <div className={styles.headRow}>
          <button type="button" className={styles.link} onClick={() => { localStorage.removeItem(PLACE_KEY); setPlace(undefined); setConditions(undefined); }}>
            Change place
          </button>
          <label className={styles.toggle}>
            <input type="checkbox" id="sensitive" checked={sensitive} onChange={toggleSensitive} />
            <span>I&apos;m sensitive to smoke</span>
          </label>
        </div>
      </header>

      {error && (
        <section className={styles.card} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.secondary} onClick={() => refresh(place, sensitive)}>Try again</button>
        </section>
      )}
      {!conditions && !error && <p className={styles.loading} aria-live="polite">Checking conditions near {place.name}…</p>}

      {conditions && (
        <>
          {conditions.summary && (
            <section className={styles.sylvia} aria-live="polite">
              <p className="eyebrow">Sylvia says</p>
              <p>{conditions.summary}</p>
            </section>
          )}
          <FireDangerCard c={conditions} />
          <div className={styles.grid}>
            <AirCard c={conditions} />
            <SmokeCard c={conditions} />
          </div>
          <FireActivityCard c={conditions} />
          {conditions.weather && <WeatherCard c={conditions} />}
          <p className="muted">
            Sylvia adds to official alerts and never replaces them. {loading ? "Updating…" : `Updated ${ago(conditions.generatedAt)}.`}
          </p>
        </>
      )}
    </div>
  );
}

function Source({ s, at }: { s: { name: string; url: string }; at?: string }) {
  return (
    <p className={styles.source}>
      <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
      {at && ` · ${ago(at)}`}
    </p>
  );
}

function FireDangerCard({ c }: { c: Conditions }) {
  const fd = c.fireDanger;
  const index = fd.level ? FIRE_DANGER.indexOf(fd.level) : -1;
  return (
    <section className={styles.card}>
      <p className="eyebrow">Official fire danger</p>
      {fd.level ? (
        <>
          <p className={styles.big}>{fd.level}</p>
          <ol className={styles.scale} aria-label={`Fire danger scale, current level ${fd.level}`}>
            {FIRE_DANGER.map((l, i) => (
              <li key={l} className={`${styles.step} ${styles[`fdr${i}`]}`} aria-current={i === index ? "true" : undefined}>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>{fd.reason}.</p>
      )}
      <Source s={fd.source} />
    </section>
  );
}

function AirCard({ c }: { c: Conditions }) {
  const a = c.aqhi;
  return (
    <section className={styles.card}>
      <p className="eyebrow">Air Quality Health Index</p>
      {a ? (
        <>
          <p className={styles.big}>
            <span className={styles.reading}>{a.value}</span> {a.risk} risk
          </p>
          <p>{a.message}</p>
          <p className="muted">{a.station}, {a.distanceKm} km away</p>
          <Source s={a.source} at={a.observedAt} />
        </>
      ) : (
        <p>No AQHI station within 120 km of here.</p>
      )}
    </section>
  );
}

function SmokeCard({ c }: { c: Conditions }) {
  const p = c.pm25;
  return (
    <section className={styles.card}>
      <p className="eyebrow">Smoke sensors nearby</p>
      {p ? (
        <>
          <p className={styles.big}>
            <span className={styles.reading}>{p.median}</span> µg/m³
          </p>
          <p>{p.label} · median of {p.sensors} sensor{p.sensors === 1 ? "" : "s"} within 10 km</p>
          <Source s={p.source} at={p.observedAt} />
        </>
      ) : (
        <p>{c.pm25Note}</p>
      )}
    </section>
  );
}

function FireActivityCard({ c }: { c: Conditions }) {
  const h = c.hotspots;
  const f = c.fires;
  return (
    <section className={styles.card}>
      <p className="eyebrow">Fire activity</p>
      <dl className={styles.facts}>
        <div>
          <dt>Heat detected by satellite, last 24 h</dt>
          <dd>{h.count ? `${h.count} within ${h.radiusKm} km · nearest ${h.nearestKm} km` : `None within ${h.radiusKm} km`}</dd>
        </div>
        <div>
          <dt>Mapped fire areas this season</dt>
          <dd>
            {f.count
              ? `${f.count} within ${f.radiusKm} km · nearest ${f.nearestKm} km${f.areaHa ? `, ${Math.round(f.areaHa).toLocaleString("en-CA")} ha` : ""}${f.lastSeen ? `, last active ${ago(f.lastSeen)}` : ""}`
              : `None within ${f.radiusKm} km`}
          </dd>
        </div>
      </dl>
      <p className="muted">Satellite heat detections are unconfirmed and can include other heat sources.</p>
      <Source s={h.source} at={h.latestAt} />
      <Source s={f.source} />
    </section>
  );
}

function WeatherCard({ c }: { c: Conditions }) {
  const w = c.weather!;
  return (
    <section className={styles.card}>
      <p className="eyebrow">Weather now</p>
      <dl className={styles.wx}>
        <div><dt>Temperature</dt><dd className={styles.reading}>{w.tempC} °C</dd></div>
        <div><dt>Humidity</dt><dd className={styles.reading}>{w.humidity}%</dd></div>
        <div><dt>Wind</dt><dd className={styles.reading}>{w.windKmh} km/h {w.windFrom}</dd></div>
      </dl>
      <Source s={w.source} at={w.observedAt} />
    </section>
  );
}

function PlacePicker({ onChoose }: { onChoose: (p: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function useMine() {
    setBusy(true);
    setMessage("");
    try {
      const at = await getLocation();
      const res = await fetch(`/api/places?lat=${at.lat}&lon=${at.lon}`);
      onChoose(await res.json());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className="eyebrow">Welcome to Sylvia</p>
        <h1 className="display">Where&apos;s home?</h1>
        <p>I&apos;ll show fire danger, air quality and fire activity near you. Your location stays on this device.</p>
      </header>
      <button type="button" className={styles.primary} onClick={useMine} disabled={busy}>
        {busy ? "Finding you…" : "Use my location"}
      </button>
      {message && <p role="alert" className={styles.error}>{message}</p>}
      <div className={styles.search}>
        <label htmlFor="place-search" className={styles.label}>Or search for a town or address</label>
        <input id="place-search" className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kenora, Kamloops, Thunder Bay…" autoComplete="off" />
        {results.length > 0 && (
          <ul className={styles.results}>
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" onClick={() => onChoose({ ...r, lat: Math.round(r.lat * 100) / 100, lon: Math.round(r.lon * 100) / 100 })}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
