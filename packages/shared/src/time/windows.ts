import { DateTime } from "luxon";

export type Instant = Date | number;
export type Interval = { start: Date; end: Date };

const toDt = (instant: Instant, zone: string) =>
  DateTime.fromMillis(typeof instant === "number" ? instant : instant.getTime(), { zone });

/** Wall-clock time on a local date. Minutes may be 1440 (= next day's midnight). */
export function zonedTime(isoDate: string, minutes: number, zone: string): DateTime {
  const day = DateTime.fromISO(isoDate, { zone }).startOf("day");
  if (minutes >= 1440) return day.plus({ days: 1 });
  return DateTime.fromObject(
    { year: day.year, month: day.month, day: day.day, hour: Math.floor(minutes / 60), minute: minutes % 60 },
    { zone }
  );
}

/** The whole local day as UTC instants; 23 or 25 hours long on DST days. */
export function localDayWindow(isoDate: string, zone: string): Interval {
  const start = DateTime.fromISO(isoDate, { zone }).startOf("day");
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

/** A window such as 08:00–21:00 on one local date, built per date so DST moves it correctly. */
export function dayWindow(isoDate: string, zone: string, startMinute: number, endMinute: number): Interval {
  return { start: zonedTime(isoDate, startMinute, zone).toJSDate(), end: zonedTime(isoDate, endMinute, zone).toJSDate() };
}

export function localDate(instant: Instant, zone: string): string {
  return toDt(instant, zone).toISODate()!;
}

export function localClockMinutes(instant: Instant, zone: string): number {
  const dt = toDt(instant, zone);
  return dt.hour * 60 + dt.minute;
}

/** ISO weekday 1 = Mon … 7 = Sun, in the given zone. */
export function localWeekday(instant: Instant, zone: string): number {
  return toDt(instant, zone).weekday;
}

export function addDays(isoDate: string, n: number): string {
  return DateTime.fromISO(isoDate, { zone: "UTC" }).plus({ days: n }).toISODate()!;
}

export function offsetMinutes(instant: Instant, zone: string): number {
  return toDt(instant, zone).offset;
}

export { toDt };
