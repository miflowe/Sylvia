"use client";
import type { Place } from "@sylvia/core";
import { withDevice } from "./device";

export type PushSupport = "ok" | "needs-install" | "unsupported";

/** iPhones only allow web push for apps added to the Home Screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (ios && !standalone) return "needs-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "ok" : "unsupported";
}

function keyBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function turnOnAlerts(home: Place, sensitive: boolean): Promise<void> {
  if ((await Notification.requestPermission()) !== "granted") {
    throw new Error("Notifications are blocked. Allow them for this site in your browser or phone settings.");
  }
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = (await fetch("/api/push/key").then((r) => r.json())) as { publicKey: string };
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  await saveSubscription(subscription, home, sensitive);
}

async function saveSubscription(subscription: PushSubscription, home: Place, sensitive: boolean) {
  const res = await fetch("/api/push/subscribe", withDevice({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), home, sensitive }),
  }));
  if (!res.ok) throw new Error("Couldn't turn on alerts. Please try again.");
}

/** Keeps the server's copy of the home area and sensitivity in step after they change on the Home screen. */
export async function syncAlerts(home: Place, sensitive: boolean): Promise<void> {
  if (pushSupport() !== "ok") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) await saveSubscription(subscription, home, sensitive);
}

export async function turnOffAlerts(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  await (await reg?.pushManager.getSubscription())?.unsubscribe();
  await fetch("/api/push/subscribe", withDevice({ method: "DELETE" }));
}
