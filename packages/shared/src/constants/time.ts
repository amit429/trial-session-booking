/** Milliseconds in common units, so code never repeats 60_000 or 86_400_000. */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** ISO weekday labels, index 1 = Monday … 7 = Sunday (index 0 unused). */
export const WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
