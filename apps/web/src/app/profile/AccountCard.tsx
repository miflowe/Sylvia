"use client";
import { useEffect, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { authConfig, currentAccount, signIn, signOut } from "@/lib/auth";
import { withDevice } from "@/lib/device";
import styles from "./profile.module.css";

/** Optional sign-in to sync across devices. Hidden until sign-in is configured. */
export function AccountCard() {
  const [enabled, setEnabled] = useState(false);
  const [account, setAccount] = useState<AccountInfo | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authConfig().then(async (c) => {
      setEnabled(c.enabled);
      if (c.enabled) setAccount(await currentAccount());
    });
  }, []);

  async function deleteData() {
    const res = await fetch("/api/auth/account", await withDevice({ method: "DELETE" }));
    if (res.ok) {
      setMessage("Your Sylvia data is deleted. Signing you out…");
      setTimeout(() => signOut(), 1500);
    } else setMessage("Couldn't delete right now. Please try again.");
  }

  if (!enabled) return null;
  return (
    <section className={styles.section} aria-labelledby="account">
      <h2 id="account" className="sectionTitle">{account ? `Signed in${account.name ? ` as ${account.name}` : ""}` : "Use Sylvia on more than one device"}</h2>
      {account ? (
        <>
          <p className="muted">Your saved plants, checklist and alert settings follow you to any device where you sign in.</p>
          <div className={styles.buttons}>
            <button type="button" className="btn btnOutline" onClick={() => signOut()}>Sign out</button>
            {!confirming ? (
              <button type="button" className="btn btnOutline" onClick={() => setConfirming(true)}>Delete my data</button>
            ) : (
              <button type="button" className={styles.danger} onClick={deleteData}>Yes, delete everything</button>
            )}
          </div>
          {confirming && <p className="muted">This removes your saved plants, photos, checklist, alerts and alert settings from Sylvia. It can&apos;t be undone.</p>}
        </>
      ) : (
        <>
          <p className="muted">Sign in with your email to keep your saved plants, checklist and alerts on every device. It&apos;s optional: Sylvia works fully without an account. We don&apos;t copy your email into our database.</p>
          <button type="button" className={styles.signIn} onClick={() => signIn()}>Sign in with email</button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
