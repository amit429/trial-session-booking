import type { BookingDto } from "@shared";

/** Confirmed and still in the future: the only state that can be cancelled. */
export const isUpcoming = (b: Pick<BookingDto, "status" | "startUtc">) => b.status === "CONFIRMED" && new Date(b.startUtc) > new Date();
