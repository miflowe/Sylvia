/**
 * Alert levels. Sylvia issues Level 1–2 advisories from data, always labelled "unverified". Official evacuation
 * alerts are relayed at Level 2 and official evacuation orders at Level 3, always naming the issuing agency.
 * Sylvia never tells people to evacuate on its own and never gives routes.
 */
export type AlertLevel = 0 | 1 | 2 | 3;

export const ALERT_LEVELS: Record<AlertLevel, { name: string; token: string }> = {
  0: { name: "All clear", token: "alert-clear" },
  1: { name: "Advisory", token: "alert-advisory" },
  2: { name: "Warning", token: "alert-warning" },
  3: { name: "Official order", token: "alert-evacuate" },
};

export interface DataSource {
  name: string; // e.g. "NASA FIRMS", "6 PurpleAir sensors"
  observedAt: string; // ISO-8601
  url?: string;
}

export interface Alert {
  level: AlertLevel;
  title: string;
  body: string;
  sources: DataSource[];
  /** True when relaying a government alert or order. */
  official?: boolean;
  /** Required on official alerts: the agency that issued it. */
  issuingAgency?: string;
  /** Link to the official source, for official alerts. */
  url?: string;
  /** Same key = same situation; used to avoid repeating an alert. */
  key?: string;
  replay?: boolean;
}

export class AlertAuthorityError extends Error {}

/** Throws if an alert claims more authority than Sylvia has. */
export function assertAlertAuthority(alert: Alert): void {
  if (alert.sources.length === 0) {
    throw new AlertAuthorityError("Every alert must cite at least one source.");
  }
  if (alert.level === 3 && !(alert.official && alert.issuingAgency)) {
    throw new AlertAuthorityError("Level 3 may only relay an official order and must name the agency.");
  }
  if (alert.official && !alert.issuingAgency) {
    throw new AlertAuthorityError("Official alerts must name the issuing agency.");
  }
  if (!alert.official && alert.issuingAgency) {
    throw new AlertAuthorityError("Only official alerts name an issuing agency.");
  }
}

/** Sylvia's own advisories are always shown as unverified. */
export function verificationLabel(alert: Alert): string {
  return alert.official ? `Official · ${alert.issuingAgency}` : "Unverified · from Sylvia";
}
