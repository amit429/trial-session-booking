/**
 * One place for TanStack Query keys, so features can invalidate each other's data
 * (e.g. booking or cancelling refreshes slots and My bookings) without importing each other.
 */
export const queryKeys = {
  me: ["me"] as const,
  slots: {
    all: ["slots"] as const,
    forZone: (tz: string) => ["slots", tz] as const,
    suggestions: (tz: string, startUtc: string) => ["slots", "suggestions", tz, startUtc] as const
  },
  booking: (reference: string, token?: string) => ["booking", reference, token ?? null] as const,
  myBookings: ["my-bookings"] as const,
  admin: {
    all: ["admin"] as const,
    dashboard: ["admin", "dashboard"] as const,
    bookings: (filters: object) => ["admin", "bookings", filters] as const,
    booking: (reference: string) => ["admin", "booking", reference] as const,
    parents: (q: string) => ["admin", "parents", q] as const,
    parent: (id: string) => ["admin", "parent", id] as const,
    mentors: ["admin", "mentors"] as const,
    mentorSchedule: (id: string) => ["admin", "mentor", id] as const,
    outbox: ["admin", "outbox"] as const
  },
  devOutbox: ["dev-outbox"] as const
};
