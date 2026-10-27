"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import styles from "./TabBar.module.css";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/sprout", label: "Sprout", icon: "sprout" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className={styles.bar} aria-label="Main">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={styles.tab} aria-current={active ? "page" : undefined}>
            <span className={styles.pill}>
              <Icon name={t.icon} />
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
