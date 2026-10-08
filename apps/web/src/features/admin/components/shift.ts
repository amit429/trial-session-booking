import { WEEKDAY_SHORT, formatHhmm, type WeeklyShiftDto } from "@shared";

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** "1:00 PM – 11:30 PM" for a mentor's (single) shift block. */
export const shiftText = (shift: WeeklyShiftDto[]) => (shift[0] ? `${formatHhmm(shift[0].start)} – ${formatHhmm(shift[0].end)}` : "No shift");

export const daysOff = (shift: WeeklyShiftDto[]) =>
  ALL_WEEKDAYS.filter(d => !shift.some(s => s.weekday === d))
    .map(d => WEEKDAY_SHORT[d])
    .join(", ");
