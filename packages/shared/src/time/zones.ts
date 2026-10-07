import { IANAZone } from "luxon";

/** Legacy names some browsers still report, mapped to canonical IANA names. */
const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "US/Eastern": "America/New_York",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Denver",
  "US/Arizona": "America/Phoenix",
  "US/Pacific": "America/Los_Angeles",
  "US/Alaska": "America/Anchorage",
  "US/Hawaii": "Pacific/Honolulu",
  GB: "Europe/London",
  "GB-Eire": "Europe/London",
  Eire: "Europe/Dublin"
};

/** Shown first in the time-zone picker. */
export const PINNED_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Dublin",
  "Asia/Kolkata"
];

/** Friendly long names; anything else falls back to the Intl long name. */
export const ZONE_NAMES: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Arizona Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii Time",
  "Europe/London": "UK time",
  "Europe/Dublin": "Irish time",
  "Asia/Kolkata": "India Standard Time"
};

export class InvalidZoneError extends Error {
  constructor(zone: string) {
    super(`Unknown time zone: ${zone}`);
    this.name = "InvalidZoneError";
  }
}

export function normalizeZone(zone: string): string {
  const name = ALIASES[zone] ?? zone;
  if (!name || !IANAZone.isValidZone(name)) throw new InvalidZoneError(zone);
  return name;
}

export function isValidZone(zone: string): boolean {
  try {
    normalizeZone(zone);
    return true;
  } catch {
    return false;
  }
}
