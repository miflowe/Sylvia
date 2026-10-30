"use client";
import { Dancing_Script } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { WELCOMED_KEY } from "@/lib/welcome";
import { playLeaves } from "./welcomeLeaves";
import styles from "./WelcomeIntro.module.css";

const script = Dancing_Script({ subsets: ["latin"], weight: "600" });


// The writing is slow and calm; the leaves run between slow (1.8) and the designed pace (1).
const WRITE_S = 2.7;
const LEAF_SPEED = 1.4;

/**
 * First launch only: "hello" is written in, leaves fall until the screen is covered, then a gust blows them away
 * to reveal the app. Skip is always available; with reduced motion on, the greeting simply fades out.
 */
export function WelcomeIntro() {
  const [gone, setGone] = useState(false);
  const [phase, setPhase] = useState<"write" | "leaves" | "fade">("write");
  const canvas = useRef<HTMLCanvasElement>(null);
  const stop = useRef<() => void>(() => {});

  const finish = () => {
    stop.current();
    try {
      localStorage.setItem(WELCOMED_KEY, "1");
    } catch {}
    document.documentElement.classList.add("welcomed");
    setGone(true);
  };

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(WELCOMED_KEY);
    } catch {}
    if (seen) return setGone(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timers.push(setTimeout(() => setPhase("fade"), 1600));
      timers.push(setTimeout(finish, 2200));
    } else {
      timers.push(
        setTimeout(() => {
          if (!canvas.current) return;
          stop.current = playLeaves(canvas.current, LEAF_SPEED, () => setPhase("leaves"), finish);
        }, (WRITE_S + 0.9) * 1000),
      );
    }
    stop.current = () => timers.forEach(clearTimeout);
    return () => timers.forEach(clearTimeout);
  }, []);

  if (gone) return null;
  return (
    <div className={`${styles.intro} welcome`} data-phase={phase}>
      <div className={styles.greeting} aria-hidden="true">
        <p className={`${styles.ink} ${script.className}`} style={{ animationDuration: `${WRITE_S}s` }}>
          hello
        </p>
        <p className={styles.sub} style={{ animationDelay: `${0.3 + WRITE_S * 0.85}s` }}>Welcome to Sylvia</p>
      </div>
      <canvas ref={canvas} className={styles.leaves} aria-hidden="true" />
      <button type="button" className={styles.skip} onClick={finish}>
        Skip intro
      </button>
    </div>
  );
}
