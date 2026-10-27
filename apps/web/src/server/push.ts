import "server-only";
import webpush from "web-push";
import { verificationLabel, type Alert } from "@sylvia/core";
import { env } from "./env";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://github.com/miflowe/Sylvia", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  configured = true;
}

export type StoredSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Same payload shape as the Functions app sends, so the service worker treats them alike. */
export async function pushToDevice(sub: StoredSubscription, alert: Pick<Alert, "level" | "title" | "body" | "official" | "issuingAgency" | "replay" | "key" | "sources">): Promise<"sent" | "gone" | "failed"> {
  configure();
  const payload = JSON.stringify({
    title: alert.replay ? `Replay: ${alert.title}` : alert.title,
    body: alert.level === 0 ? alert.body : `${verificationLabel(alert as Alert)}. ${alert.body}`,
    level: alert.level,
    tag: alert.key,
    url: "/alerts",
  });
  try {
    await webpush.sendNotification(sub, payload, { TTL: 3600, urgency: alert.level >= 2 ? "high" : "normal" });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
