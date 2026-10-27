"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Place } from "@sylvia/core";
import { AlertBanner, type AlertItem } from "@/components/AlertBanner";
import { pushSupport, turnOffAlerts, turnOnAlerts, type PushSupport } from "@/lib/alerts";
import { withDevice } from "@/lib/device";
import styles from "./alerts.module.css";

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function AlertsCenter({ replay }: { replay?: React.ReactNode }) {
  const [place, setPlace] = useState<Place | undefined>();
  const [sensitive, setSensitive] = useState(false);
  const [support, setSupport] = useState<PushSupport>("ok");
  const [subscribed, setSubscribed] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/alerts", withDevice());
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
    const res = await fetch("/api/push/test", withDevice({ method: "POST" }));
    setMessage(res.ok ? "Test sent. It should appear in a few seconds." : "The test didn't go through. Try turning alerts off and on again.");
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className="eyebrow">Alerts</p>
        <h1 className="display">Early warnings for your home</h1>
      </header>

      <section className={styles.card} aria-labelledby="alerts-setup">
        <h2 id="alerts-setup" className={styles.cardTitle}>
          {subscribed ? `Alerts are on${place ? ` for ${place.name}` : ""}` : "Turn on alerts"}
        </h2>
        {!place ? (
          <p>
            First, set your home on the <Link href="/">Home</Link> tab.
          </p>
        ) : support === "needs-install" ? (
          <p>On iPhone, add Sylvia to your Home Screen first: tap Share, then &quot;Add to Home Screen&quot;, and open Sylvia from there.</p>
        ) : support === "unsupported" ? (
          <p>This browser can&apos;t receive notifications. Try Chrome, Edge, Firefox or Safari on a recent phone.</p>
        ) : (
          <>
            <p className="muted">
              I&apos;ll notify you about fire activity, smoke and official evacuation orders near your home. To do that I store your home
              area rounded to about 1 km{sensitive ? " and that you're sensitive to smoke" : ""}. Turning alerts off deletes it.
            </p>
            <div className={styles.row}>
              <button type="button" className={subscribed ? styles.secondary : styles.primary} onClick={toggle} disabled={busy}>
                {busy ? "One moment…" : subscribed ? "Turn off alerts" : "Turn on alerts"}
              </button>
              {subscribed && (
                <button type="button" className={styles.secondary} onClick={test}>
                  Send a test
                </button>
              )}
            </div>
          </>
        )}
        {message && <p role="status" className={styles.message}>{message}</p>}
      </section>

      <section className={styles.levels} aria-labelledby="levels">
        <h2 id="levels" className={styles.cardTitle}>What the levels mean</h2>
        <ul>
          <li><b>Level 1 · Advisory.</b> Smoke or heat detected nearby. From Sylvia, unverified.</li>
          <li><b>Level 2 · Warning.</b> Fire activity close to home, or an official evacuation alert. Be ready to leave.</li>
          <li><b>Level 3 · Official order.</b> A government evacuation order for your area, passed on word for word with the agency named.</li>
        </ul>
        <p className="muted">Sylvia adds to official alerts and never replaces them. Keep Alert Ready and local alerts on.</p>
      </section>

      {replay}

      <section aria-labelledby="history" className={styles.history}>
        <h2 id="history" className={styles.cardTitle}>Alert history</h2>
        {alerts === undefined && <p className="muted">Loading…</p>}
        {alerts?.length === 0 && <p className="muted">No alerts yet. That&apos;s good news.</p>}
        {alerts?.map((a) => <AlertBanner key={a.id} alert={a} />)}
      </section>
    </div>
  );
}
