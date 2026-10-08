import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PINNED_ZONES, addDays, dayWindow, formatTime, localDate } from "@shared";
import { buildSlots, type EngineBooking, type EngineConfig, type EngineMentor } from "@/domain/scheduling/slot-engine";
import { MENTOR_SEED, seedRules } from "@/data/seed-mentors";

const CFG: EngineConfig = { minNoticeMinutes: 120, horizonDays: 14, stepMinutes: 30, durationMinutes: 60, maxDailyTrials: 2, parentStartMinute: 480, parentEndMinute: 1260 };
const IST = "Asia/Kolkata";
const allWeek: EngineMentor[] = MENTOR_SEED.map((m, i) => ({ id: `m${i}`, timezone: IST, maxDailyTrials: 2, rules: seedRules(m.shift, 0) }));
const seeded: EngineMentor[] = MENTOR_SEED.map((m, i) => ({ id: `m${i}`, timezone: IST, maxDailyTrials: 2, rules: seedRules(m.shift, m.off) }));

/** "8:00 AM".."1:00 PM" every 30 minutes, as rendered for the parent. */
function range(from: string, to: string) {
  const toMin = (s: string) => { const [h, rest] = s.split(":"); const [m, ap] = rest.split(" "); return ((+h % 12) + (ap === "PM" ? 12 : 0)) * 60 + +m; };
  const out: string[] = [];
  for (let t = toMin(from); t <= toMin(to); t += 30) { const h = Math.floor(t / 60); out.push(`${((h + 11) % 12) + 1}:${String(t % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`); }
  return out;
}
function starts(tz: string, date: string, mentors: EngineMentor[], bookings: EngineBooking[] = [], now = "2026-10-01T00:00:00Z") {
  const [day] = buildSlots({ parentTz: tz, fromDate: date, days: 1, now: new Date(now), config: { ...CFG, horizonDays: 60 }, mentors, bookings });
  return day;
}
const times = (tz: string, day: ReturnType<typeof starts>) => day.slots.map(s => formatTime(s.startUtc, tz));

describe("coverage matches PRD §7.3 (all mentors working)", () => {
  it("New York before the clock change", () => {
    expect(times("America/New_York", starts("America/New_York", "2026-10-20", allWeek))).toEqual([...range("8:00 AM", "1:00 PM"), ...range("3:00 PM", "8:00 PM")]);
  });
  it("New York after the clock change", () => {
    expect(times("America/New_York", starts("America/New_York", "2026-11-10", allWeek))).toEqual([...range("8:00 AM", "12:00 PM"), ...range("2:00 PM", "8:00 PM")]);
  });
  it("London after the clock change", () => {
    expect(times("Europe/London", starts("Europe/London", "2026-11-10", allWeek))).toEqual([...range("8:00 AM", "5:00 PM"), ...range("7:00 PM", "8:00 PM")]);
  });
  it("US Pacific loses its 7:30 and 8:00 PM starts after 1 Nov", () => {
    const before = times("America/Los_Angeles", starts("America/Los_Angeles", "2026-10-20", allWeek));
    const after = times("America/Los_Angeles", starts("America/Los_Angeles", "2026-11-10", allWeek));
    expect(before.at(-1)).toBe("8:00 PM");
    expect(after.at(-1)).toBe("7:00 PM");
  });
});

describe("availability rules", () => {
  const one: EngineMentor[] = [{ id: "a", timezone: IST, maxDailyTrials: 2, rules: seedRules("UK", 0) }];
  const bk = (iso: string): EngineBooking => ({ mentorId: "a", startUtc: new Date(iso), endUtc: new Date(new Date(iso).getTime() + 3_600_000), mentorLocalDate: localDate(new Date(iso), IST) });

  it("a mentor with 2 trials on an IST date is unavailable for the rest of that date", () => {
    const day = starts("Europe/London", "2026-10-20", one, [bk("2026-10-20T08:00:00Z"), bk("2026-10-20T10:00:00Z")]);
    expect(day.slots.length).toBeGreaterThan(0);
    expect(day.slots.every(s => s.status === "FULL")).toBe(true);
    expect(day.status).toBe("FULL");
  });

  it("an existing class blocks overlapping starts but not back-to-back ones", () => {
    const day = starts("Europe/London", "2026-10-20", one, [bk("2026-10-20T12:00:00Z")]);
    const at = (iso: string) => day.slots.find(s => s.startUtc.toISOString() === iso)!;
    expect(at("2026-10-20T11:30:00.000Z").status).toBe("FULL");
    expect(at("2026-10-20T12:30:00.000Z").status).toBe("FULL");
    expect(at("2026-10-20T13:00:00.000Z").status).toBe("OPEN");
    expect(at("2026-10-20T11:00:00.000Z").status).toBe("OPEN");
  });

  it("never offers anything within the notice period", () => {
    const day = starts("America/New_York", "2026-10-20", allWeek, [], "2026-10-20T14:00:00Z");
    expect(day.slots[0].startUtc.toISOString()).toBe("2026-10-20T16:00:00.000Z");
  });

  it("marks a day with no mentor on shift as CLOSED", () => {
    const sundayOff: EngineMentor[] = [{ id: "a", timezone: IST, maxDailyTrials: 2, rules: seedRules("UK", 7) }];
    expect(starts("Europe/London", "2026-10-25", sundayOff).status).toBe("CLOSED");
  });

  it("stops at the booking horizon", () => {
    const days = buildSlots({ parentTz: "America/New_York", fromDate: "2026-10-20", days: 20, now: new Date("2026-10-20T14:00:00Z"), config: CFG, mentors: allWeek, bookings: [] });
    expect(days).toHaveLength(14);
    expect(days.at(-1)!.date).toBe("2026-11-02");
  });
});

describe("property: every slot respects both reasonable-hours rules", () => {
  it("holds for random zones, dates and bookings", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PINNED_ZONES.filter(z => z !== IST)),
        fc.integer({ min: 0, max: 59 }),
        fc.array(fc.record({ m: fc.integer({ min: 0, max: 9 }), slot: fc.integer({ min: 0, max: 40 }) }), { maxLength: 25 }),
        (tz, offset, raw) => {
          const date = addDays("2026-10-15", offset);
          const base = dayWindow(date, IST, 0, 0).start.getTime();
          const bookings: EngineBooking[] = raw.map(({ m, slot }) => {
            const s = new Date(base + slot * 1_800_000);
            return { mentorId: `m${m}`, startUtc: s, endUtc: new Date(s.getTime() + 3_600_000), mentorLocalDate: localDate(s, IST) };
          });
          const [day] = buildSlots({ parentTz: tz, fromDate: date, days: 1, now: new Date("2026-10-01T00:00:00Z"), config: { ...CFG, horizonDays: 90 }, mentors: seeded, bookings });
          const win = dayWindow(date, tz, CFG.parentStartMinute, CFG.parentEndMinute);
          for (const s of day.slots) {
            expect(s.startUtc >= win.start && s.endUtc <= win.end).toBe(true);
            if (s.status === "OPEN") expect(s.availableMentorIds.length).toBeGreaterThan(0);
            for (const id of s.availableMentorIds) {
              const d = localDate(s.startUtc, IST);
              const count = bookings.filter(b => b.mentorId === id && b.mentorLocalDate === d).length;
              expect(count).toBeLessThan(2);
              expect(bookings.some(b => b.mentorId === id && b.startUtc < s.endUtc && s.startUtc < b.endUtc)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 150 }
    );
  });
});
