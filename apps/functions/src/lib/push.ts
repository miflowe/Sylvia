import webpush from "web-push";
import { verificationLabel, type Alert } from "@sylvia/core";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://github.com/miflowe/Sylvia",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Sends one alert. Returns "gone" when the browser has dropped the subscription (delete it). */
export async function pushAlert(sub: StoredSubscription, alert: Alert & { id?: string }): Promise<"sent" | "gone" | "failed"> {
  configure();
  const payload = JSON.stringify({
    title: alert.replay ? `Replay: ${alert.title}` : alert.title,
    body: `${verificationLabel(alert)}. ${alert.body}`,
    level: alert.level,
    tag: alert.key ?? alert.id,
    url: "/alerts",
  });
  try {
    // Official orders are urgent; advisories can wait for the device to wake.
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: alert.level >= 2 ? "high" : "normal" });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
