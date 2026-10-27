"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Place } from "@sylvia/core";
import { Icon } from "@/components/Icon";
import { syncAlerts } from "@/lib/alerts";

/** Home place, the one health setting, and a way into alerts. */
export function Settings() {
  const [place, setPlace] = useState<Place | undefined>();
  const [sensitive, setSensitive] = useState(false);

  useEffect(() => {
    try {
      setPlace(JSON.parse(localStorage.getItem("sylvia.place") ?? "null") ?? undefined);
      setSensitive(JSON.parse(localStorage.getItem("sylvia.sensitive") ?? "false"));
    } catch {}
  }, []);

  function toggle() {
    const next = !sensitive;
    setSensitive(next);
    try {
      localStorage.setItem("sylvia.sensitive", JSON.stringify(next));
    } catch {}
    if (place) syncAlerts(place, next).catch(() => {});
  }

  return (
    <section aria-labelledby="settings" style={{ display: "grid", gap: "var(--space-2)" }}>
      <h2 id="settings" className="sectionTitle">Settings</h2>
      <ul className="list">
        <li>
          <Link href="/" className="listRow">
            <span className="listIcon"><Icon name="home" size={20} /></span>
            <span className="listText">
              <span className="listTitle">Home</span>
              <span className="listSub">{place?.name ?? "Not set"}</span>
            </span>
            <Icon name="chevronRight" size={20} className="chevron" />
          </Link>
        </li>
        <li>
          <div className="listRow">
            <span className="listIcon"><Icon name="heart" size={20} /></span>
            <span className="listText">
              <span className="listTitle" id="sensitive-label">I&apos;m sensitive to smoke</span>
              <span className="listSub">Get smoke advice and alerts sooner</span>
            </span>
            <button type="button" role="switch" aria-checked={sensitive} aria-labelledby="sensitive-label" className="switch" onClick={toggle} />
          </div>
        </li>
        <li>
          <Link href="/alerts" className="listRow">
            <span className="listIcon"><Icon name="bell" size={20} /></span>
            <span className="listText"><span className="listTitle">Alerts</span></span>
            <Icon name="chevronRight" size={20} className="chevron" />
          </Link>
        </li>
      </ul>
    </section>
  );
}
