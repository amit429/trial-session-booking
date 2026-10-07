import { DateTime } from "luxon";
import { addDays, type Interval, localDate, zonedTime } from "./windows";

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number };

/**
 * Expand weekly rules (wall-clock times in `zone`) into concrete UTC intervals that overlap [from, to).
 * Local times inside a spring-forward gap move to the first valid time (Luxon's behaviour).
 */
export function expandRules(rules: WeeklyRule[], zone: string, from: Date, to: Date): Interval[] {
  const out: Interval[] = [];
  const last = addDays(localDate(to, zone), 1);
  for (let d = addDays(localDate(from, zone), -1); d <= last; d = addDays(d, 1)) {
    const weekday = DateTime.fromISO(d, { zone }).weekday;
    for (const r of rules) {
      if (r.weekday !== weekday) continue;
      const start = zonedTime(d, r.startMinute, zone).toJSDate();
      const end = zonedTime(d, r.endMinute, zone).toJSDate();
      if (start < to && end > from && end > start) out.push({ start, end });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
