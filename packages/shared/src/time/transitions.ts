import { addDays, offsetMinutes, zonedTime } from "./windows";

export type Transition = { date: string; at: Date; fromOffset: number; toOffset: number; back: boolean };

/** Offset changes (clock changes) between consecutive local days in [fromDate, fromDate + days). */
export function upcomingTransitions(zone: string, fromDate: string, days: number): Transition[] {
  const out: Transition[] = [];
  let prev = offsetMinutes(zonedTime(fromDate, 720, zone).toJSDate(), zone);
  for (let i = 1; i < days; i++) {
    const date = addDays(fromDate, i);
    const at = zonedTime(date, 720, zone).toJSDate();
    const off = offsetMinutes(at, zone);
    if (off !== prev) out.push({ date, at, fromOffset: prev, toOffset: off, back: off < prev });
    prev = off;
  }
  return out;
}
