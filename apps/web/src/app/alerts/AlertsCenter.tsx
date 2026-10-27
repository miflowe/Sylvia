"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Place } from "@sylvia/core";
import { AlertBanner, type AlertItem } from "@/components/AlertBanner";
import { Icon } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { pushSupport, turnOffAlerts, turnOnAlerts, type PushSupport } from "@/lib/alerts";
import { withDevice } from "@/lib/device";
import { ReplayPanel } from "./ReplayPanel";
import styles from "./alerts.module.css";

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

const LEVELS = [
  { n: 1, name: "Advisory", text: "Smoke or heat detected nearby. From Sylvia, unverified." },
  { n: 2, name: "Warning", text: "Fire activity close to home, or an official evacuation alert. Be ready to leave." },
  { n: 3, name: "Official order", text: "A government evacuation order for your area, passed on word for word with the agency named." },
] as const;

export function AlertsCenter() {
  const [place, setPlace] = useState<Place | undefined>();
  const [sensitive, setSensitive] = useState(false);
  const [support, setSupport] = useState<PushSupport>("ok");
  const [subscribed, setSubscribed] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/alerts", await withDevice());
    if (!res.ok) return setAlerts([]);
    const body = (await res.json()) as { alerts: AlertItem[]; subscribed: boolean };
    setAlerts(body.alerts);
    setSubscribed(body.subscribed);
  }, []);

  useEffect(() => {
    setPlace(load<Place>("sylvia.place"));
    setSensitive(load<boolean>("sylvia.sensitive") ?? false);
    setSupport(pushSupport());
    refresh();
    // Pick up alerts that arrive while the tab is open (new pushes, replay steps).
    const t = setInterval(refresh, 20000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (subscribed) {
        await turnOffAlerts();
        setSubscribed(false);
        setMessage("Alerts are off. I've deleted your stored home area.");
      } else if (place) {
        await turnOnAlerts(place, sensitive);
        setSubscribed(true);
        setMessage("Alerts are on.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMessage("");
    const res = await fetch("/api/push/test", await withDevice({ method: "POST" }));
    setMessage(res.ok ? "Test sent. It should appear in a few seconds." : "The test didn't go through. Try turning alerts off and on again.");
  }

  // Replays are practice, so the status line only looks at real alerts from the last day.
  const latest = alerts?.find((a) => !a.replay);
  const recent = latest?.createdAt && Date.now() - Date.parse(latest.createdAt) < 24 * 3600 * 1000 ? latest : undefined;

  return (
    <>
      <ScreenHeader caption="Alerts" title="Early warnings" />

      <section className={styles.status} aria-live="polite">
        <span className={`${styles.statusIcon} ${recent ? styles[`l${recent.level}`] : ""}`}>
          <Icon name={recent ? "bell" : "shieldCheck"} size={26} />
        </span>
        <div>
          <p className={styles.statusTitle}>
            {alerts === undefined ? "Checking…" : recent ? `Level ${recent.level}: ${recent.title}` : "No Sylvia alerts in the last day"}
          </p>
          <p className="muted">{place ? `For ${place.name}` : "Set your home on the Home tab"} · keep Alert Ready on too</p>
        </div>
      </section>

      <section aria-labelledby="alerts-setup" className={styles.group}>
        <h2 id="alerts-setup" className="sectionTitle">Notifications</h2>
        {!place ? (
          <p className="card">
            First, set your home on the <Link href="/">Home</Link> tab.
          </p>
        ) : support === "needs-install" ? (
          <p className="card">On iPhone, add Sylvia to your Home Screen first: tap Share, then &quot;Add to Home Screen&quot;, and open Sylvia from there.</p>
        ) : support === "unsupported" ? (
          <p className="card">This browser can&apos;t receive notifications. Try Chrome, Edge, Firefox or Safari on a recent phone.</p>
        ) : (
          <>
            <ul className="list">
              <li>
                <div className="listRow">
                  <span className="listIcon"><Icon name="bell" size={20} /></span>
                  <span className="listText">
                    <span className="listTitle" id="push-label">Push alerts</span>
                    <span className="listSub">{busy ? "One moment…" : subscribed ? `On for ${place.name}` : "Fire, smoke and official orders"}</span>
                  </span>
                  <button type="button" role="switch" aria-checked={subscribed} aria-labelledby="push-label" className="switch" onClick={toggle} disabled={busy} />
                </div>
              </li>
              {subscribed && (
                <li>
                  <button type="button" className="listRow" onClick={test}>
                    <span className="listIcon"><Icon name="play" size={18} /></span>
                    <span className="listText"><span className="listTitle">Send a test</span></span>
                    <Icon name="chevronRight" size={20} className="chevron" />
                  </button>
                </li>
              )}
            </ul>
            <p className={styles.note}>
              To alert you I store your home area rounded to about 1 km{sensitive ? " and that you're sensitive to smoke" : ""}. Turning alerts off deletes it.
            </p>
          </>
        )}
        {message && <p role="status" className={styles.message}>{message}</p>}
      </section>

      <section aria-labelledby="levels" className={styles.group}>
        <h2 id="levels" className="sectionTitle">What the levels mean</h2>
        <ul className="list">
          {LEVELS.map((l) => (
            <li key={l.n} className="listRow">
              <span className={`${styles.badge} ${styles[`l${l.n}`]}`} aria-hidden="true">{l.n}</span>
              <span className="listText">
                <span className="listTitle">Level {l.n} · {l.name}</span>
                <span className="listSub">{l.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>Sylvia adds to official alerts and never replaces them. Keep Alert Ready and local alerts on.</p>
      </section>

      <ReplayPanel onAlerts={refresh} />

      <section aria-labelledby="history" className={styles.group}>
        <h2 id="history" className="sectionTitle">Alert history</h2>
        {alerts === undefined && <p className="muted">Loading…</p>}
        {alerts?.length === 0 && <p className="card muted">No alerts yet. That&apos;s good news.</p>}
        {alerts?.map((a) => <AlertBanner key={a.id} alert={a} />)}
      </section>
    </>
  );
}
