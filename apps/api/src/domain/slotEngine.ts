import { addDays, dayWindow, expandRules, gridStarts, localDate, localDayWindow, type Interval, type WeeklyRule } from "@trial/shared";

/** Pure availability engine (Technical Design §8). No I/O: callers load mentors and bookings. */

export type EngineConfig = {
  minNoticeMinutes: number;
  horizonDays: number;
  stepMinutes: number;
  durationMinutes: number;
  maxDailyTrials: number;
  parentStartMinute: number;
  parentEndMinute: number;
};
export type EngineMentor = { id: string; timezone: string; maxDailyTrials: number; rules: WeeklyRule[] };
export type EngineBooking = { mentorId: string; startUtc: Date; endUtc: Date; mentorLocalDate: string };
export type SlotStatus = "OPEN" | "FULL";
export type Slot = { startUtc: Date; endUtc: Date; status: SlotStatus; availableMentors: number; availableMentorIds: string[] };
export type DayStatus = "OPEN" | "FULL" | "CLOSED";
export type Day = { date: string; status: DayStatus; slots: Slot[] };
export type EngineInput = {
  parentTz: string;
  fromDate: string;
  days: number;
  now: Date;
  config: EngineConfig;
  mentors: EngineMentor[];
  bookings: EngineBooking[];
};

type Prepared = {
  mentor: EngineMentor;
  shifts: Interval[];
  busy: { start: number; end: number }[];
  perDay: Map<string, number>;
};

const MIN = 60_000;

function prepare(mentors: EngineMentor[], bookings: EngineBooking[], from: Date, to: Date): Prepared[] {
  const pad = 2 * 86_400_000;
  return mentors.map(mentor => {
    const mine = bookings.filter(b => b.mentorId === mentor.id);
    const perDay = new Map<string, number>();
    for (const b of mine) perDay.set(b.mentorLocalDate, (perDay.get(b.mentorLocalDate) ?? 0) + 1);
    return {
      mentor,
      shifts: expandRules(mentor.rules, mentor.timezone, new Date(from.getTime() - pad), new Date(to.getTime() + pad)),
      busy: mine.map(b => ({ start: b.startUtc.getTime(), end: b.endUtc.getTime() })),
      perDay
    };
  });
}

const isStaffed = (p: Prepared, start: number, end: number) => p.shifts.some(s => s.start.getTime() <= start && end <= s.end.getTime());
const isFree = (p: Prepared, start: number, end: number) => !p.busy.some(b => b.start < end && start < b.end);
const isUnderCap = (p: Prepared, start: number) => (p.perDay.get(localDate(start, p.mentor.timezone)) ?? 0) < p.mentor.maxDailyTrials;

/** First instant past the bookable horizon for this parent. */
export function horizonEnd(parentTz: string, now: Date, config: EngineConfig): Date {
  return localDayWindow(addDays(localDate(now, parentTz), config.horizonDays), parentTz).start;
}

export function isInParentWindow(start: Date, parentTz: string, config: EngineConfig): boolean {
  const w = dayWindow(localDate(start, parentTz), parentTz, config.parentStartMinute, config.parentEndMinute);
  return start >= w.start && start.getTime() + config.durationMinutes * MIN <= w.end.getTime();
}

export function buildSlots(input: EngineInput): Day[] {
  const { parentTz, fromDate, days, now, config } = input;
  const limit = horizonEnd(parentTz, now, config);
  const earliest = now.getTime() + config.minNoticeMinutes * MIN;
  const duration = config.durationMinutes * MIN;
  const rangeStart = localDayWindow(fromDate, parentTz).start;
  const rangeEnd = localDayWindow(addDays(fromDate, days), parentTz).start;
  const prepared = prepare(input.mentors, input.bookings, rangeStart, rangeEnd);

  const out: Day[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    if (localDayWindow(date, parentTz).start >= limit) break;
    const win = dayWindow(date, parentTz, config.parentStartMinute, config.parentEndMinute);
    const slots: Slot[] = [];
    for (const s of gridStarts(win.start, new Date(win.end.getTime() - duration), config.stepMinutes)) {
      const start = s.getTime();
      const end = start + duration;
      if (start < earliest || start >= limit.getTime()) continue;
      const staffed = prepared.filter(p => isStaffed(p, start, end));
      if (!staffed.length) continue;
      const available = staffed.filter(p => isFree(p, start, end) && isUnderCap(p, start));
      slots.push({
        startUtc: s,
        endUtc: new Date(end),
        status: available.length ? "OPEN" : "FULL",
        availableMentors: available.length,
        availableMentorIds: available.map(p => p.mentor.id)
      });
    }
    const status: DayStatus = slots.some(x => x.status === "OPEN") ? "OPEN" : slots.length ? "FULL" : "CLOSED";
    out.push({ date, status, slots });
  }
  return out;
}

/** Mentors on shift for [start, start + duration), regardless of bookings. */
export function staffedMentorsAt(start: Date, mentors: EngineMentor[], config: EngineConfig): EngineMentor[] {
  const s = start.getTime();
  const e = s + config.durationMinutes * MIN;
  return prepare(mentors, [], start, new Date(e)).filter(p => isStaffed(p, s, e)).map(p => p.mentor);
}

/** Mentors who can take a class at `start` right now: on shift, free and under their daily cap. */
export function availableMentorsAt(start: Date, mentors: EngineMentor[], bookings: EngineBooking[], config: EngineConfig): EngineMentor[] {
  const s = start.getTime();
  const e = s + config.durationMinutes * MIN;
  return prepare(mentors, bookings, start, new Date(e))
    .filter(p => isStaffed(p, s, e) && isFree(p, s, e) && isUnderCap(p, s))
    .map(p => p.mentor);
}
