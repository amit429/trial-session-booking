import { DAY_MS } from "@shared";
import type { Db } from "@/core/db";
import type { DbClient } from "@/core/types";

/** Reads the engine needs: active mentors with shifts, and confirmed bookings near a window. */
export class SlotsRepository {
  constructor(private db: Db) {}

  activeMentorsWithRules(client: DbClient = this.db) {
    return client.mentor.findMany({ where: { isActive: true }, include: { rules: true }, orderBy: { id: "asc" } });
  }

  /** Confirmed bookings overlapping [from, to), padded by two days for per-India-date counting. */
  confirmedAround(from: Date, to: Date, client: DbClient = this.db) {
    const pad = 2 * DAY_MS;
    return client.booking.findMany({
      where: { status: "CONFIRMED", startUtc: { lt: new Date(to.getTime() + pad) }, endUtc: { gt: new Date(from.getTime() - pad) } },
      select: { mentorId: true, startUtc: true, endUtc: true, mentorLocalDate: true }
    });
  }
}
