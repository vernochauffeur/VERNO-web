import { describe, it, expect } from "vitest";
import { EVENTS, formatEventDates, upcomingEvents, melbourneToday } from "./events.js";

describe("events page data", () => {
  it("has valid, ordered dates", () => {
    for (const e of EVENTS) {
      expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end >= e.start).toBe(true);
    }
  });

  it("formats date ranges", () => {
    expect(formatEventDates({ start: "2026-12-26", end: "2026-12-30" })).toBe("26–30 December 2026");
    expect(formatEventDates({ start: "2027-04-30", end: "2027-05-02" })).toBe("30 April – 2 May 2027");
    expect(formatEventDates({ start: "2026-12-31", end: "2027-01-01" })).toBe("31 December 2026 – 1 January 2027");
    expect(formatEventDates({ start: "2027-03-11", end: "2027-03-11" })).toBe("11 March 2027");
  });

  it("drops events once they have finished", () => {
    expect(upcomingEvents("2026-11-25").map((e) => e.name)).toEqual([
      "Boxing Day Test", "Australian Open", "150th Anniversary Test", "Formula 1 Australian Grand Prix",
    ]);
    expect(upcomingEvents("2026-12-30").map((e) => e.name)[0]).toBe("Boxing Day Test"); // last day still shown
    expect(upcomingEvents("2026-12-31").map((e) => e.name)[0]).toBe("Australian Open");
    expect(upcomingEvents("2027-04-05")).toEqual([]);
  });

  it("uses the Melbourne date", () => {
    // 14:00 UTC on 25 Nov is 01:00 on 26 Nov in Melbourne (AEDT, UTC+11).
    expect(melbourneToday(new Date("2026-11-25T14:00:00Z"))).toBe("2026-11-26");
  });
});
