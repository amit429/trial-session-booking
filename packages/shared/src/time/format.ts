import { type Instant, toDt } from "./windows";
import { ZONE_NAMES } from "./zones";

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "−" : "+";
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Short zone label. Never a bare "IST": India and Irish summer time share it. */
export function zoneAbbreviation(zone: string, instant: Instant): string {
  const dt = toDt(instant, zone);
  if (zone === "Europe/London") return dt.offset === 60 ? "BST" : "GMT";
  if (zone === "Europe/Dublin") return dt.offset === 60 ? "GMT+1" : "GMT";
  if (zone === "Asia/Kolkata") return "IST (India)";
  return dt.setLocale("en-US").toFormat("ZZZZ");
}

/** Long label with offset, e.g. "Eastern Time (UTC−04:00)". */
export function formatZoneLabel(zone: string, instant: Instant): string {
  const dt = toDt(instant, zone);
  const name = ZONE_NAMES[zone] ?? dt.setLocale("en-US").toFormat("ZZZZZ");
  return `${name} (${formatOffset(dt.offset)})`;
}

export function formatTime(instant: Instant, zone: string, h24 = false): string {
  return toDt(instant, zone)
    .setLocale("en-US")
    .toFormat(h24 ? "HH:mm" : "h:mm a");
}

export function formatDay(instant: Instant, zone: string): string {
  return toDt(instant, zone).setLocale("en-GB").toFormat("ccc d LLL");
}

export function formatDayLong(instant: Instant, zone: string): string {
  return toDt(instant, zone).setLocale("en-GB").toFormat("cccc d LLLL");
}

/** "Sat 31 Oct · 8:30 AM EDT" */
export function formatSlot(instant: Instant, zone: string): string {
  return `${formatDay(instant, zone)} · ${formatTime(instant, zone)} ${zoneAbbreviation(zone, instant)}`;
}

/** "9:00 AM" from minutes since local midnight. */
export function formatClockMinutes(minutes: number, h24 = false): string {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  if (h24) return `${String(h).padStart(2, "0")}:${m}`;
  return `${((h + 11) % 12) + 1}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

export type TimeOfDay = "morning" | "afternoon" | "evening";
export function timeOfDayGroup(instant: Instant, zone: string): TimeOfDay {
  const dt = toDt(instant, zone);
  const m = dt.hour * 60 + dt.minute;
  return m < 720 ? "morning" : m < 1020 ? "afternoon" : "evening";
}

/** "19:30" → "7:30 PM". */
export function formatHhmm(hhmm: string, h24 = false): string {
  const [h, m] = hhmm.split(":").map(Number);
  return formatClockMinutes(h * 60 + m, h24);
}
