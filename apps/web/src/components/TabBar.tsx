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
      <Link href="/" className={styles.brand} aria-label="Sylvia home">
        <span className={styles.brandMark}>
          <Icon name="leaf" size={20} />
        </span>
        <span className={styles.brandName}>Sylvia</span>
      </Link>
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={styles.tab} aria-current={active ? "page" : undefined}>
            <span className={styles.pill}>
              <Icon name={t.icon} />
            </span>
            <span className={styles.label}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
