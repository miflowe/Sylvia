"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { finishSignIn, idToken } from "@/lib/auth";
import { getDeviceId } from "@/lib/device";

/** Entra sends people back here after sign-in. Links this device's data to the account, then returns to Profile. */
export default function AuthReturn() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        const account = await finishSignIn();
        const token = await idToken();
        if (account && token) {
          await fetch("/api/auth/link", { method: "POST", headers: { "x-sylvia-device": getDeviceId(), authorization: `Bearer ${token}` } });
        }
        router.replace("/profile");
      } catch {
        setMessage("Sign-in didn't finish. Go back to Profile and try again.");
      }
    })();
  }, [router]);

  return (
    <main className="screen">
      <p role="status">{message}</p>
    </main>
  );
}
