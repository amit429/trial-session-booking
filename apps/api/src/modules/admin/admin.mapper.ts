import type { AvailabilityRule, Mentor } from "@prisma/client";
import { formatClockMinutes, localWeekday, zonedTime, type WeeklyShiftDto } from "@shared";

export const toWeeklyShift = (rules: AvailabilityRule[]): WeeklyShiftDto[] =>
  [...rules]
    .sort((a, b) => a.weekday - b.weekday)
    .map(r => ({ weekday: r.weekday, start: formatClockMinutes(r.startMinute, true), end: formatClockMinutes(r.endMinute % 1440, true) }));

/** Is the mentor on shift on this local calendar date (their zone)? */
export const isOnShift = (m: Mentor & { rules: AvailabilityRule[] }, isoDate: string) => {
  const weekday = localWeekday(zonedTime(isoDate, 720, m.timezone).toJSDate(), m.timezone);
  return m.rules.some(r => r.weekday === weekday);
};
