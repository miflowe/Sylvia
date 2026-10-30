import { describe, expect, it } from "vitest";
import { answerProblem, guardQuestion } from "./ask";

describe("guardQuestion", () => {
  it("lets everyday questions through", () => {
    expect(guardQuestion("Is it OK to go for a run today?").ok).toBe(true);
    expect(guardQuestion("Should I close my windows?").ok).toBe(true);
  });

  it("never gives routes and names the official source for the region", () => {
    const g = guardQuestion("What's the safest way out of town?", "CA-BC");
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reply).toMatch(/can't give evacuation routes.*EmergencyInfoBC/);
  });

  it("never decides whether someone should leave", () => {
    for (const q of ["Should I evacuate?", "Do we need to leave tonight?", "Is it safe to stay?"]) {
      const g = guardQuestion(q, "CA-ON");
      expect(!g.ok && g.reply).toMatch(/Only officials order evacuations/);
    }
  });

  it("sends emergencies to 911 first", () => {
    const g = guardQuestion("I'm trapped and the fire is here");
    expect(!g.ok && g.reply).toBe("If you are in danger, call 911 now.");
  });

  it("rejects empty and very long questions", () => {
    expect(guardQuestion(" ").ok).toBe(false);
    expect(guardQuestion("a".repeat(300)).ok).toBe(false);
  });
});

describe("answerProblem", () => {
  it("blocks fireproof claims and evacuation directives", () => {
    expect(answerProblem("Plant ninebark, it's fireproof.")).toMatch(/forbidden/);
    expect(answerProblem("Leave now and take Highway 97 south.")).toBe("evacuation directive");
    expect(answerProblem("The air is good right now, so a run should be fine.")).toBeUndefined();
  });
});
