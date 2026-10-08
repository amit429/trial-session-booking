import { Prisma, type Booking, type Mentor, type Parent } from "@prisma/client";
import { MINUTE_MS } from "@shared";
import type { Db } from "@/core/db";
import type { DbClient } from "@/core/types";

export type FullBooking = Booking & { mentor: Mentor; parent: Parent };
export type NewBooking = Omit<Prisma.BookingUncheckedCreateInput, "id" | "status" | "createdAt" | "updatedAt">;
export type ParentContact = { name: string; email: string; phone?: string; timezone: string };

const full = { mentor: true, parent: true } as const;
/** Short transactions, generous waits: many requests may queue on one mentor's row lock. */
const TX_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 15_000 };

/** All booking reads and writes, including the row locks the booking transaction relies on. */
export class BookingsRepository {
  constructor(private db: Db) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn, TX_OPTIONS);
  }

  findByReference(reference: string) {
    return this.db.booking.findUnique({ where: { reference }, include: full });
  }

  findByIdempotencyKey(key: string, client: DbClient = this.db) {
    return client.booking.findUnique({ where: { idempotencyKey: key }, include: full });
  }

  /** Create the parent if new, then lock their row: requests for the same email serialize here. */
  async lockParent(tx: Prisma.TransactionClient, p: ParentContact) {
    await tx.$executeRaw`INSERT INTO "Parent" (id, name, email, phone, timezone, "createdAt")
      VALUES (gen_random_uuid(), ${p.name}, ${p.email}, ${p.phone ?? null}, ${p.timezone}, now())
      ON CONFLICT (email) DO NOTHING`;
    const [row] = await tx.$queryRaw<{ id: string; passwordHash: string | null }[]>`
      SELECT id::text, "passwordHash" FROM "Parent" WHERE email = ${p.email} FOR UPDATE`;
    return row;
  }

  /** Guests' contact details follow their latest booking; account holders keep theirs, except the zone. */
  updateParentContact(tx: Prisma.TransactionClient, parentId: string, p: ParentContact, isGuest: boolean) {
    return tx.parent.update({
      where: { id: parentId },
      data: isGuest ? { name: p.name, phone: p.phone ?? null, timezone: p.timezone } : { timezone: p.timezone }
    });
  }

  findUpcomingForParent(tx: Prisma.TransactionClient, parentId: string, now: Date) {
    return tx.booking.findFirst({ where: { parentId, status: "CONFIRMED", startUtc: { gt: now } }, orderBy: { startUtc: "asc" } });
  }

  /** Lock one mentor's row so concurrent bookings for that mentor run one at a time. */
  async lockMentor(tx: Prisma.TransactionClient, mentorId: string) {
    await tx.$queryRaw`SELECT id FROM "Mentor" WHERE id = ${mentorId}::uuid FOR UPDATE`;
  }

  countOverlapping(tx: Prisma.TransactionClient, mentorId: string, start: Date, end: Date) {
    return tx.booking.count({ where: { mentorId, status: "CONFIRMED", startUtc: { lt: end }, endUtc: { gt: start } } });
  }

  countOnMentorDate(tx: Prisma.TransactionClient, mentorId: string, mentorLocalDate: Date) {
    return tx.booking.count({ where: { mentorId, status: "CONFIRMED", mentorLocalDate } });
  }

  create(tx: Prisma.TransactionClient, data: NewBooking) {
    return tx.booking.create({ data, include: full });
  }

  /** Cancel only if still confirmed, so two simultaneous cancels can't both notify people. */
  async cancelIfConfirmed(tx: Prisma.TransactionClient, id: string, by: "PARENT" | "ADMIN", now: Date): Promise<FullBooking | null> {
    const { count } = await tx.booking.updateMany({ where: { id, status: "CONFIRMED" }, data: { status: "CANCELLED", cancelledAt: now, cancelledBy: by } });
    return count ? tx.booking.findUniqueOrThrow({ where: { id }, include: full }) : null;
  }

  listForParent(parentId: string, scope: "upcoming" | "past" | "all", now: Date) {
    return this.db.booking.findMany({
      where: {
        parentId,
        ...(scope === "upcoming" ? { status: "CONFIRMED", startUtc: { gt: now } } : {}),
        ...(scope === "past" ? { OR: [{ status: "CANCELLED" }, { startUtc: { lte: now } }] } : {})
      },
      include: full,
      orderBy: { startUtc: scope === "upcoming" ? "asc" : "desc" }
    });
  }
}

export const classEnd = (start: Date, durationMinutes: number) => new Date(start.getTime() + durationMinutes * MINUTE_MS);
