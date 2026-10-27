import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AccountCard } from "./AccountCard";
import { FireSmartChecklist } from "./FireSmartChecklist";
import { SavedScans } from "./SavedScans";
import { Settings } from "./Settings";

export const metadata = { title: "Profile · Sylvia" };

export default function ProfilePage() {
  return (
    <main className="screen">
      <ScreenHeader caption="Profile" title="Your home" />
      <Settings />
      <FireSmartChecklist />
      <SavedScans />
      <AccountCard />
      <section aria-labelledby="more" style={{ display: "grid", gap: "var(--space-2)" }}>
        <h2 id="more" className="sectionTitle">More</h2>
        <ul className="list">
          <li>
            <Link href="/communities/central-okanagan" className="listRow">
              <span className="listIcon"><Icon name="building" size={20} /></span>
              <span className="listText">
                <span className="listTitle">Community view</span>
                <span className="listSub">For towns: see Central Okanagan</span>
              </span>
              <Icon name="chevronRight" size={20} className="chevron" />
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="listRow">
              <span className="listIcon"><Icon name="shieldCheck" size={20} /></span>
              <span className="listText"><span className="listTitle">Privacy</span></span>
              <Icon name="chevronRight" size={20} className="chevron" />
            </Link>
          </li>
          <li>
            <Link href="/terms" className="listRow">
              <span className="listIcon"><Icon name="doc" size={20} /></span>
              <span className="listText"><span className="listTitle">Terms and safety</span></span>
              <Icon name="chevronRight" size={20} className="chevron" />
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
