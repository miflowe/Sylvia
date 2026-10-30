"use client";
import { useEffect, useState } from "react";
import styles from "./DesktopSiteHint.module.css";

/**
 * A phone browser in "Desktop site" mode lays the page out 980 px wide and shrinks it, so everything looks tiny.
 * The page can't undo that, so this says how to turn it off. Shown only when the screen is phone-sized but the page
 * is much wider than the screen.
 */
export function DesktopSiteHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("sylvia.desktopHint") === "hidden";
    } catch {}
    setShow(!dismissed && screen.width < 700 && innerWidth > screen.width * 1.4);
  }, []);

  if (!show) return null;
  return (
    <div className={styles.hint} role="note">
      <p>
        Your browser is showing the desktop site, so Sylvia looks small. In the browser menu, turn off <b>Desktop site</b> for
        the phone layout.
      </p>
      <button
        type="button"
        className={styles.close}
        aria-label="Hide this note"
        onClick={() => {
          setShow(false);
          try {
            sessionStorage.setItem("sylvia.desktopHint", "hidden");
          } catch {}
        }}
      >
        ×
      </button>
    </div>
  );
}
