"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FIRE_DANGER, type Conditions, type Place } from "@sylvia/core";
import { Icon, type IconName } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Sheet } from "@/components/Sheet";
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

/** "Environment and Climate Change Canada (AQHI)" → "AQHI", for tight spaces; the full name is one tap away. */
const shortSource = (name: string) => name.match(/\(([^)]+)\)\s*$/)?.[1] ?? name;

type Detail = "air" | "fire" | "weather" | "smoke";

export function HomeDashboard() {
  const [place, setPlace] = useState<Place | undefined>();
  const [ready, setReady] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [conditions, setConditions] = useState<Conditions | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | undefined>();

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
    setPicking(false);
    syncAlerts(p, sensitive).catch(() => {});
  };

  // Before the saved place is read, show the loading shape so the first paint isn't blank.
  if (!ready) return <Skeleton />;
  if (!place || picking) return <PlacePicker onChoose={choose} onCancel={place ? () => setPicking(false) : undefined} />;

  const c = conditions;
  return (
    <>
      <ScreenHeader
        caption="Your home"
        title={
          <button type="button" className={styles.place} onClick={() => setPicking(true)} aria-label={`${place.name}. Change place`}>
            <span>{place.name}</span>
            <Icon name="chevronDown" size={22} />
          </button>
        }
        action={
          <Link href="/alerts" className="iconButton" aria-label="Alerts">
            <Icon name="bell" />
          </Link>
        }
      >
        {sensitive && (
          <Link href="/profile" className={styles.chip}>
            <Icon name="heart" size={16} /> Sensitive to smoke: earlier smoke advice
          </Link>
        )}
      </ScreenHeader>

      {error && (
        <section className="card" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btnOutline" style={{ marginTop: 12 }} onClick={() => refresh(place, sensitive)}>
            Try again
          </button>
        </section>
      )}

      {!c && !error && (
        <>
          <p className="sr-only" aria-live="polite">Checking conditions near {place.name}…</p>
          <Skeleton />
        </>
      )}

      {c && (
        <>
          <FireDangerHero c={c} />

          {c.summary && (
            <section className={styles.sylvia} aria-live="polite">
              <span className={styles.avatar} aria-hidden="true">
                <Icon name="leaf" size={20} />
              </span>
              <div>
                <p className={styles.sylviaLabel}>Sylvia says</p>
                <p>{c.summary}</p>
              </div>
            </section>
          )}

          <div className={styles.tiles}>
            <Tile
              icon="wind"
              tone="sky"
              label="Air quality"
              value={c.aqhi ? String(c.aqhi.value) : "–"}
              unit={c.aqhi ? `${c.aqhi.risk} risk` : "No station"}
              foot={c.aqhi ? `${shortSource(c.aqhi.source.name)} · ${ago(c.aqhi.observedAt)}` : "Within 120 km"}
              onOpen={() => setDetail("air")}
            />
            <Tile
              icon="flame"
              tone="ember"
              label="Fire nearby"
              value={String(c.hotspots.count)}
              unit={`heat in ${c.hotspots.radiusKm} km`}
              foot={`${c.fires.count} fire area${c.fires.count === 1 ? "" : "s"} in ${c.fires.radiusKm} km`}
              onOpen={() => setDetail("fire")}
            />
            <Tile
              icon="thermometer"
              tone="ember"
              label="Weather"
              value={c.weather ? `${c.weather.tempC}°` : "–"}
              unit={c.weather ? `${c.weather.humidity}% · ${c.weather.windKmh} km/h ${c.weather.windFrom}` : "Unavailable"}
              foot={c.weather ? `${shortSource(c.weather.source.name)} · ${ago(c.weather.observedAt)}` : ""}
              onOpen={c.weather ? () => setDetail("weather") : undefined}
            />
            <Tile
              icon="sensor"
              tone="sky"
              label="Smoke sensors"
              value={c.pm25 ? String(c.pm25.median) : "–"}
              unit={c.pm25 ? `µg/m³ · ${c.pm25.label}` : "None within 10 km"}
              foot={c.pm25 ? `${shortSource(c.pm25.source.name)} · ${ago(c.pm25.observedAt)}` : "Street-level PM2.5"}
              onOpen={() => setDetail("smoke")}
            />
          </div>

          <p className={styles.footnote}>
            Sylvia adds to official alerts and never replaces them. In an emergency, call 911. {loading ? "Updating…" : `Updated ${ago(c.generatedAt)}.`}{" "}
            <a href="/terms">Safety notice</a>
          </p>

          <Sheet title={detailTitle[detail ?? "air"]} open={!!detail} onClose={() => setDetail(undefined)}>
            {detail === "air" && <AirDetail c={c} />}
            {detail === "fire" && <FireDetail c={c} />}
            {detail === "weather" && <WeatherDetail c={c} />}
            {detail === "smoke" && <SmokeDetail c={c} />}
          </Sheet>
        </>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <>
      <div className={`${styles.hero} ${styles.skeleton}`} aria-hidden="true" />
      <div className={styles.tiles} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${styles.tile} ${styles.skeleton}`} />)}
      </div>
    </>
  );
}

const detailTitle: Record<Detail, string> = {
  air: "Air Quality Health Index",
  fire: "Fire activity",
  weather: "Weather now",
  smoke: "Smoke sensors nearby",
};

function Tile({ icon, tone, label, value, unit, foot, onOpen }: { icon: IconName; tone: "sky" | "ember"; label: string; value: string; unit: string; foot: string; onOpen?: () => void }) {
  const body = (
    <>
      <span className={styles.tileHead}>
        <span className={`${styles.tileIcon} ${styles[tone]}`}>
          <Icon name={icon} size={18} />
        </span>
        <h2 className={styles.tileLabel}>{label}</h2>
      </span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileUnit}>{unit}</span>
      {foot && <span className={styles.tileFoot}>{foot}</span>}
    </>
  );
  return onOpen ? (
    <button type="button" className={styles.tile} onClick={onOpen}>
      {body}
    </button>
  ) : (
    <div className={styles.tile}>{body}</div>
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

function FireDangerHero({ c }: { c: Conditions }) {
  const fd = c.fireDanger;
  const index = fd.level ? FIRE_DANGER.indexOf(fd.level) : -1;
  return (
    <section className={styles.hero}>
      <h2 className={styles.heroLabel}>Official fire danger</h2>
      {fd.level ? (
        <>
          <p className={styles.heroValue}>{fd.level}</p>
          <ol className={styles.scale} aria-label={`Fire danger scale, current level ${fd.level}`}>
            {FIRE_DANGER.map((l, i) => (
              <li key={l} className={`${styles.step} ${styles[`fdr${i}`]}`} aria-current={i === index ? "true" : undefined}>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className={styles.heroReason}>{fd.reason}.</p>
      )}
      <p className={styles.heroSource}>
        <a href={fd.source.url} target="_blank" rel="noreferrer">{fd.source.name}</a>
      </p>
    </section>
  );
}

function AirDetail({ c }: { c: Conditions }) {
  const a = c.aqhi;
  if (!a) return <p>No AQHI station within 120 km of here.</p>;
  return (
    <>
      <p className={styles.sheetBig}>
        {a.value} <span>{a.risk} risk</span>
      </p>
      <p>{a.message}</p>
      <p className="muted">{a.station}, {a.distanceKm} km away</p>
      <Source s={a.source} at={a.observedAt} />
    </>
  );
}

function FireDetail({ c }: { c: Conditions }) {
  const h = c.hotspots;
  const f = c.fires;
  return (
    <>
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
      <Link href="/map" className="btn btnOutline">
        <Icon name="map" size={20} /> See them on the map
      </Link>
    </>
  );
}

function WeatherDetail({ c }: { c: Conditions }) {
  const w = c.weather!;
  return (
    <>
      <dl className={styles.wx}>
        <div><dt>Temperature</dt><dd>{w.tempC} °C</dd></div>
        <div><dt>Humidity</dt><dd>{w.humidity}%</dd></div>
        <div><dt>Wind</dt><dd>{w.windKmh} km/h {w.windFrom}</dd></div>
      </dl>
      <p className="muted">Dry, windy days help fires spread faster.</p>
      <Source s={w.source} at={w.observedAt} />
    </>
  );
}

function SmokeDetail({ c }: { c: Conditions }) {
  const p = c.pm25;
  if (!p) return <p>{c.pm25Note}</p>;
  return (
    <>
      <p className={styles.sheetBig}>
        {p.median} <span>µg/m³</span>
      </p>
      <p>{p.label} · median of {p.sensors} sensor{p.sensors === 1 ? "" : "s"} within 10 km</p>
      <Source s={p.source} at={p.observedAt} />
    </>
  );
}

function PlacePicker({ onChoose, onCancel }: { onChoose: (p: Place) => void; onCancel?: () => void }) {
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
    <>
      <div className={styles.welcome}>
        <span className={styles.welcomeMark} aria-hidden="true">
          <Icon name="leaf" size={36} />
        </span>
        <p className="screenCaption">{onCancel ? "Change place" : "Welcome to Sylvia"}</p>
        <h1 className="screenTitle">Where&apos;s home?</h1>
        <p>I&apos;ll show fire danger, air quality and fire activity near you. Your location stays on this device.</p>
      </div>

      <button type="button" className="btn btnPrimary btnBlock" onClick={useMine} disabled={busy}>
        <Icon name="locate" size={20} /> {busy ? "Finding you…" : "Use my location"}
      </button>
      {message && <p role="alert" className={styles.error}>{message}</p>}

      <div className={styles.search}>
        <label htmlFor="place-search" className={styles.label}>Or search for a town or address</label>
        <div className={styles.inputWrap}>
          <Icon name="search" size={20} className={styles.inputIcon} />
          <input id="place-search" className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kenora, Kamloops, Thunder Bay…" autoComplete="off" />
        </div>
        {results.length > 0 && (
          <ul className="list">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" className="listRow" onClick={() => onChoose({ ...r, lat: Math.round(r.lat * 100) / 100, lon: Math.round(r.lon * 100) / 100 })}>
                  <span className="listIcon"><Icon name="pin" size={20} /></span>
                  <span className="listText"><span className="listTitle">{r.name}</span></span>
                  <Icon name="chevronRight" size={20} className="chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onCancel ? (
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      ) : (
        <p className="muted">
          Sylvia is not an emergency service and adds to official alerts. By using it you agree to the <a href="/terms">terms</a> and{" "}
          <a href="/privacy">privacy policy</a>.
        </p>
      )}
    </>
  );
}
