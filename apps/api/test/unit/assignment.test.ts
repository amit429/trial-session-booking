import { describe, expect, it } from "vitest";
import { localDate } from "@shared";
import { rankMentors } from "@/domain/scheduling/assignment";
import type { EngineBooking, EngineConfig, EngineMentor } from "@/domain/scheduling/slot-engine";

const CFG: EngineConfig = { minNoticeMinutes: 0, horizonDays: 14, stepMinutes: 30, durationMinutes: 60, maxDailyTrials: 2, parentStartMinute: 480, parentEndMinute: 1260 };
const IST = "Asia/Kolkata";
const allDays = (start: number, end: number) => [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, startMinute: start, endMinute: end }));
const bk = (id: string, iso: string): EngineBooking => ({ mentorId: id, startUtc: new Date(iso), endUtc: new Date(new Date(iso).getTime() + 3_600_000), mentorLocalDate: localDate(new Date(iso), IST) });

describe("rankMentors", () => {
  const start = new Date("2026-10-21T13:30:00Z"); // 19:00 IST
  const now = new Date("2026-10-20T00:00:00Z");

  it("prefers the mentor with fewer trials that IST day", () => {
    const mentors: EngineMentor[] = [{ id: "a", timezone: IST, maxDailyTrials: 2, rules: allDays(780, 1410) }, { id: "b", timezone: IST, maxDailyTrials: 2, rules: allDays(780, 1410) }];
    const ranked = rankMentors(mentors, start, { mentors, bookings: [bk("a", "2026-10-21T09:00:00Z")], config: CFG, now });
    expect(ranked.map(m => m.id)).toEqual(["b", "a"]);
  });

  it("on equal load prefers the mentor with fewer other open slots (keeps flexible mentors free)", () => {
    const mentors: EngineMentor[] = [
      { id: "wide", timezone: IST, maxDailyTrials: 2, rules: allDays(600, 1410) },
      { id: "narrow", timezone: IST, maxDailyTrials: 2, rules: allDays(1080, 1260) }
    ];
    expect(rankMentors(mentors, start, { mentors, bookings: [], config: CFG, now }).map(m => m.id)).toEqual(["narrow", "wide"]);
  });

  it("breaks remaining ties by id", () => {
    const mentors: EngineMentor[] = ["c", "a", "b"].map(id => ({ id, timezone: IST, maxDailyTrials: 2, rules: allDays(780, 1410) }));
    expect(rankMentors(mentors, start, { mentors, bookings: [], config: CFG, now }).map(m => m.id)).toEqual(["a", "b", "c"]);
  });
});
