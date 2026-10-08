import type { Prisma } from "@prisma/client";
import type { Db } from "@/core/db";

const full = { mentor: true, parent: true } as const;

/** Read models for the admin console. */
export class AdminRepository {
  constructor(private db: Db) {}

  activeMentorsWithRules() {
    return this.db.mentor.findMany({ where: { isActive: true }, include: { rules: true } });
  }

  confirmedCountsByMentorDate(from: Date, to: Date) {
    return this.db.booking.groupBy({ by: ["mentorLocalDate"], where: { status: "CONFIRMED", mentorLocalDate: { gte: from, lte: to } }, _count: { _all: true } });
  }

  countConfirmedStarting(from: Date, to: Date) {
    return this.db.booking.count({ where: { status: "CONFIRMED", startUtc: { gt: from, lt: to } } });
  }

  searchBookings(where: Prisma.BookingWhereInput, order: "asc" | "desc", page: number, pageSize: number) {
    return Promise.all([
      this.db.booking.findMany({ where, include: full, orderBy: { startUtc: order }, skip: (page - 1) * pageSize, take: pageSize }),
      this.db.booking.count({ where })
    ]);
  }

  bookingWithMessages(reference: string) {
    return this.db.booking.findUnique({ where: { reference }, include: { ...full, outbox: { orderBy: { createdAt: "asc" } } } });
  }

  mentorsWithUpcoming(now: Date) {
    return this.db.mentor.findMany({
      include: { rules: true, bookings: { where: { status: "CONFIRMED", startUtc: { gt: now } }, select: { mentorLocalDate: true } } },
      orderBy: { name: "asc" }
    });
  }

  mentorWithRules(id: string) {
    return this.db.mentor.findUnique({ where: { id }, include: { rules: true } });
  }

  confirmedForMentorBetweenDates(mentorId: string, from: Date, to: Date) {
    return this.db.booking.findMany({ where: { mentorId, status: "CONFIRMED", mentorLocalDate: { gte: from, lte: to } }, include: full, orderBy: { startUtc: "asc" } });
  }
}
