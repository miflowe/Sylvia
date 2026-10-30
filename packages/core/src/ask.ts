/**
 * Ask Sylvia: short answers about today's conditions at the person's home, from live readings only.
 * The hard lines live here, outside the model: Sylvia never gives evacuation routes, never decides whether someone
 * should leave (only officials order evacuations), and never calls a plant fireproof. Questions that ask for those
 * get a fixed reply; answers that cross them are replaced.
 */
import { findForbiddenClaims } from "./plants";

export const ASK_MAX_CHARS = 280;

export const ASK_SUGGESTIONS = ["Is it OK to go for a run today?", "Should I close my windows?", "Will smoke get worse this week?"] as const;

/** Where official evacuation information lives, by pilot region. */
export function officialInfo(regionCode?: string): string {
  return regionCode === "CA-BC"
    ? "EmergencyInfoBC (emergencyinfobc.gov.bc.ca) and your regional district"
    : regionCode === "CA-ON"
      ? "your municipality and Ontario's emergency alerts (Alert Ready)"
      : "your local emergency authority and Alert Ready";
}

const ROUTES = /\b(route|routes|which way|what road|which road|escape|get out of|drive out|way out|safest way)\b/i;
const LEAVE = /\b(evacuat\w*|should (i|we) (leave|go|stay)|do (i|we) (need|have) to leave|is it safe to stay)\b/i;
const EMERGENCY = /\b(trapped|can'?t breathe|cannot breathe|fire is here|house is on fire|on fire)\b/i;

export type AskGuard = { ok: true } | { ok: false; reply: string };

/** Checks a question before it reaches the model. */
export function guardQuestion(question: string, regionCode?: string): AskGuard {
  const q = question.trim();
  if (q.length < 3) return { ok: false, reply: "Ask me about smoke, fire danger or air quality at your home." };
  if (q.length > ASK_MAX_CHARS) return { ok: false, reply: `Please keep questions under ${ASK_MAX_CHARS} characters.` };
  if (EMERGENCY.test(q)) return { ok: false, reply: "If you are in danger, call 911 now." };
  if (ROUTES.test(q)) {
    return {
      ok: false,
      reply: `I can't give evacuation routes. Roads change quickly during a fire, so follow the instructions from ${officialInfo(regionCode)}. If you are in danger, call 911.`,
    };
  }
  if (LEAVE.test(q)) {
    return {
      ok: false,
      reply: `I can't tell you whether to leave. Only officials order evacuations. Check ${officialInfo(regionCode)} and follow their instructions. If you are in danger, call 911.`,
    };
  }
  return { ok: true };
}

const DIRECTIVE = /\b(evacuate (now|immediately)|leave (now|immediately)|take (highway|hwy|route|the road)|head (north|south|east|west))\b/i;

/** Checks the model's answer; returns the reason it must not be shown, if any. */
export function answerProblem(answer: string): string | undefined {
  if (!answer.trim()) return "empty";
  const claim = findForbiddenClaims(answer);
  if (claim) return `forbidden claim: ${claim}`;
  if (DIRECTIVE.test(answer)) return "evacuation directive";
  return undefined;
}

export const ASK_FALLBACK = "I can't answer that one well right now. Check the readings on Home, and follow official alerts in an emergency.";
