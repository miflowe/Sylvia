/**
 * Alert levels. Sylvia issues Level 1–2 advisories from data; Level 3 only relays an official order.
 * Sylvia never tells people to evacuate on its own and never gives routes.
 */
export type AlertLevel = 0 | 1 | 2 | 3;

export const ALERT_LEVELS: Record<AlertLevel, { name: string; token: string; ours: boolean }> = {
  0: { name: "All clear", token: "alert-clear", ours: true },
  1: { name: "Advisory", token: "alert-advisory", ours: true },
  2: { name: "Warning", token: "alert-warning", ours: true },
  3: { name: "Official order", token: "alert-evacuate", ours: false },
};

export interface DataSource {
  name: string; // e.g. "NASA FIRMS", "6 PurpleAir sensors"
  observedAt: string; // ISO-8601
}

export interface Alert {
  level: AlertLevel;
  title: string;
  body: string;
  sources: DataSource[];
  /** Required at Level 3: the agency that issued the order. */
  issuingAgency?: string;
  replay?: boolean;
}

export class AlertAuthorityError extends Error {}

/** Throws if an alert claims more authority than Sylvia has. */
export function assertAlertAuthority(alert: Alert): void {
  if (alert.sources.length === 0) {
    throw new AlertAuthorityError("Every alert must cite at least one source.");
  }
  if (alert.level === 3 && !alert.issuingAgency) {
    throw new AlertAuthorityError("Level 3 may only relay an official order and must name the agency.");
  }
  if (alert.level < 3 && alert.issuingAgency) {
    throw new AlertAuthorityError("Official orders must be Level 3.");
  }
}

/** Level 1–2 advisories are always shown as unverified. */
export function verificationLabel(alert: Alert): string {
  return alert.level === 3 ? `Official order · ${alert.issuingAgency}` : "Unverified · from Sylvia";
}
