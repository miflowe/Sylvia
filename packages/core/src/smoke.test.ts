import { describe, expect, it } from "vitest";
import { smokeLine, smokeOutlook, timeZoneFor, whenPhrase } from "./smoke";

const issued = "2026-10-29T12:00:00Z";
// 9 a.m. PDT on Thursday Oct 29.
const now = "2026-10-29T16:00:00Z";
const vancouver = "America/Vancouver";

describe("smokeOutlook", () => {
  it("finds the peak and the first hour at that level", () => {
    const f = smokeOutlook(
      [
        { at: "2026-10-30T21:00:00Z", ugm3: 48.2 },
        { at: "2026-10-30T18:00:00Z", ugm3: 12 },
        { at: "2026-10-30T15:00:00Z", ugm3: 3 },
        { at: "2026-10-31T00:00:00Z", ugm3: 39 },
      ],
      issued,
    );
    expect(f.level).toBe("heavy");
    expect(f.peakUgm3).toBe(48.2);
    expect(f.firstAt).toBe("2026-10-30T21:00:00Z");
    expect(f.points[0]!.at).toBe("2026-10-30T15:00:00Z");
  });

  it("calls a clean forecast none, with no times", () => {
    const f = smokeOutlook([{ at: "2026-10-30T21:00:00Z", ugm3: 0.4 }], issued);
    expect(f.level).toBe("none");
    expect(f.firstAt).toBeUndefined();
    expect(smokeLine(f, "Kamloops", now, vancouver, false)).toBe("No wildfire smoke is forecast for Kamloops in the next 2 days.");
  });
});

describe("whenPhrase", () => {
  it("speaks in the place's local time", () => {
    expect(whenPhrase("2026-10-29T22:00:00Z", now, vancouver)).toBe("this afternoon");
    expect(whenPhrase("2026-10-30T05:00:00Z", now, vancouver)).toBe("tonight");
    expect(whenPhrase("2026-10-30T21:00:00Z", now, vancouver)).toBe("tomorrow afternoon");
    expect(whenPhrase("2026-10-31T17:00:00Z", now, vancouver)).toBe("on Saturday morning");
  });
});

describe("smokeLine", () => {
  const f = smokeOutlook([{ at: "2026-10-30T21:00:00Z", ugm3: 25 }], issued);
  it("says forecast, names the place and the time, and adds advice only for sensitive people at moderate", () => {
    expect(smokeLine(f, "Kamloops", now, vancouver, false)).toBe("Wildfire smoke is forecast to reach Kamloops tomorrow afternoon.");
    expect(smokeLine(f, "Kamloops", now, vancouver, true)).toMatch(/windows closed/);
  });
});

describe("timeZoneFor", () => {
  it("puts Kenora on Central time and Toronto on Eastern", () => {
    expect(timeZoneFor(-94.5, "CA-ON")).toBe("America/Winnipeg");
    expect(timeZoneFor(-79.4, "CA-ON")).toBe("America/Toronto");
    expect(timeZoneFor(-120.3, "CA-BC")).toBe("America/Vancouver");
  });
});
