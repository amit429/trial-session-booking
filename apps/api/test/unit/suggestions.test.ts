import { describe, expect, it } from "vitest";
import { dayWindow, formatSlot, zonedTime } from "@shared";
import type { Day, Slot } from "@/domain/scheduling/slot-engine";
import { rankSuggestions } from "@/domain/scheduling/suggestions";

const NY = "America/New_York";
const LIMITS = { sameDay: 4, sameTime: 3, nearest: 4 };
const at = (date: string, hhmm: string) => zonedTime(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), NY).toJSDate();
const slot = (date: string, hhmm: string, status: "OPEN" | "FULL" = "OPEN"): Slot => {
  const s = at(date, hhmm);
  return {
    startUtc: s,
    endUtc: new Date(s.getTime() + 3_600_000),
    status,
    availableMentors: status === "OPEN" ? 1 : 0,
    availableMentorIds: status === "OPEN" ? ["m"] : []
  };
};
const day = (date: string, slots: Slot[]): Day => ({
  date,
  slots,
  status: slots.some(s => s.status === "OPEN") ? "OPEN" : slots.length ? "FULL" : "CLOSED"
});
const label = (r: ReturnType<typeof rankSuggestions>) => r.suggestions.map(s => formatSlot(s.startUtc, NY));

describe("rankSuggestions", () => {
  it("step 1: same day, closest to the requested time, ties earlier first", () => {
    const days = [
      day("2026-10-21", [
        slot("2026-10-21", "08:00"),
        slot("2026-10-21", "08:30"),
        slot("2026-10-21", "09:00", "FULL"),
        slot("2026-10-21", "09:30"),
        slot("2026-10-21", "11:00"),
        slot("2026-10-21", "15:00")
      ])
    ];
    const r = rankSuggestions(days, "2026-10-21", 540, NY, LIMITS, at("2026-10-21", "09:00"));
    expect(r.strategy).toBe("SAME_DAY");
    expect(label(r)).toEqual([
      "Wed 21 Oct · 8:30 AM EDT",
      "Wed 21 Oct · 9:30 AM EDT",
      "Wed 21 Oct · 8:00 AM EDT",
      "Wed 21 Oct · 11:00 AM EDT"
    ]);
    expect(r.requested).toEqual({ date: "2026-10-21", time: "09:00", timezone: NY });
  });

  it("step 2: a full day falls back to the same time on the nearest days, ties to the later day", () => {
    const days = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"].map(d =>
      day(d, d === "2026-10-22" ? [slot(d, "09:00", "FULL")] : [slot(d, "09:00"), slot(d, "10:00")])
    );
    const r = rankSuggestions(days, "2026-10-22", 540, NY, LIMITS);
    expect(r.strategy).toBe("SAME_TIME");
    expect(label(r)).toEqual(["Fri 23 Oct · 9:00 AM EDT", "Wed 21 Oct · 9:00 AM EDT", "Sat 24 Oct · 9:00 AM EDT"]);
  });

  it("step 2 matches the parent's clock time across the 1 Nov clock change", () => {
    const days = [day("2026-10-31", [slot("2026-10-31", "09:00", "FULL")]), day("2026-11-02", [slot("2026-11-02", "09:00")])];
    const r = rankSuggestions(days, "2026-10-31", 540, NY, LIMITS);
    expect(r.strategy).toBe("SAME_TIME");
    expect(r.suggestions[0].startUtc.toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(at("2026-10-31", "09:00").toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });

  it("step 3: no day offers the time, so pick up to 2 closest per day, 4 in total", () => {
    const days = ["2026-10-20", "2026-10-21", "2026-10-22"].map(d => day(d, [slot(d, "15:00"), slot(d, "16:00"), slot(d, "17:00")]));
    days.unshift(day("2026-10-19", [slot("2026-10-19", "09:00", "FULL")]));
    const r = rankSuggestions(days, "2026-10-19", 540, NY, LIMITS);
    expect(r.strategy).toBe("NEAREST");
    expect(label(r)).toEqual([
      "Tue 20 Oct · 3:00 PM EDT",
      "Tue 20 Oct · 4:00 PM EDT",
      "Wed 21 Oct · 3:00 PM EDT",
      "Wed 21 Oct · 4:00 PM EDT"
    ]);
  });

  it("step 4: nothing open anywhere", () => {
    const r = rankSuggestions([day("2026-10-20", [slot("2026-10-20", "09:00", "FULL")])], "2026-10-20", 540, NY, LIMITS);
    expect(r).toMatchObject({ strategy: "NONE", suggestions: [] });
  });

  it("adds a note when the requested time stops being offered after a clock change", () => {
    const days = [
      day("2026-10-30", [slot("2026-10-30", "20:00", "FULL")]),
      day("2026-10-31", [slot("2026-10-31", "20:00")]),
      day("2026-11-02", [slot("2026-11-02", "19:00")])
    ];
    const r = rankSuggestions(days, "2026-10-30", 1200, NY, LIMITS, undefined, [
      { date: "2026-11-01", at: dayWindow("2026-11-01", NY, 720, 720).start, fromOffset: -240, toOffset: -300, back: true }
    ]);
    expect(r.notes[0]).toMatchObject({ type: "DST_SHIFT" });
    expect(r.notes[0].message).toBe("From Sun 1 Nov, 8:00 PM is outside our mentors' hours because the clocks change.");
  });
});
