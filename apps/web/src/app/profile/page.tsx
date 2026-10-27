import Link from "next/link";
import { AccountCard } from "./AccountCard";
import { FireSmartChecklist } from "./FireSmartChecklist";
import { SavedScans } from "./SavedScans";
import styles from "./profile.module.css";

export const metadata = { title: "Profile · Sylvia" };

export default function ProfilePage() {
  return (
    <main className="screen" style={{ display: "grid", gap: "var(--space-6)" }}>
      <header>
        <p className="eyebrow">Profile</p>
        <h1 className="display" style={{ marginBottom: 0 }}>Your home</h1>
      </header>
      <FireSmartChecklist />
      <SavedScans />
      <AccountCard />
      <footer className={styles.footer}>
        <p className="muted">Work for a town or regional district?</p>
        <Link href="/communities/central-okanagan">See the Central Okanagan community view</Link>
      </footer>
    </main>
  );
}
