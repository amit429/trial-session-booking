/** "2026-10-21" ⇄ a Date at UTC midnight, for Postgres DATE columns. */
export const dateOnlyToUtc = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
export const utcToDateOnly = (d: Date) => d.toISOString().slice(0, 10);
