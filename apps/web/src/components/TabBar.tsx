"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TabBar.module.css";

// Line icons on a 24px grid, 1.75 stroke, per the design system.
const icons: Record<string, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  map: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />,
  sprout: <path d="M12 21V11M12 11c0-4 3-7 8-7 0 4-3 7-8 7zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" />,
  alerts: <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0" />,
  profile: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6" />,
};

const tabs = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/sprout", label: "Sprout", icon: "sprout" },
  { href: "/alerts", label: "Alerts", icon: "alerts" },
  { href: "/profile", label: "Profile", icon: "profile" },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <nav className={styles.bar} aria-label="Main">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={styles.tab} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons[t.icon]}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
