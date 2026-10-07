import type { OutboxMessage, Prisma } from "@prisma/client";
import { addDays, formatClockMinutes, localDate, localWeekday, zonedTime, type OutboxDto } from "@trial/shared";
import type { Deps } from "../container";
import { notFound } from "../http/errors";
import { accountStatus, type BookingService } from "./bookingService";

const IST = "Asia/Kolkata";
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const include = { mentor: true, parent: true } as const;

export const toOutboxDto = (m: OutboxMessage & { booking?: { reference: string } | null }): OutboxDto => ({
  id: m.id, kind: m.kind, toEmail: m.toEmail, subject: m.subject, body: m.body,
  bookingReference: m.booking?.reference ?? null, createdAt: m.createdAt.toISOString()
});

export type BookingFilters = { scope: "upcoming" | "past" | "all"; status?: "CONFIRMED" | "CANCELLED"; mentorId?: string; q?: string; page: number; pageSize: number };

export class AdminService {
  constructor(private deps: Deps, private bookings: BookingService) {}

  private now() { return this.deps.clock.now(); }
  private todayIst() { return localDate(this.now(), IST); }

  /** Load per India date: booked vs capacity (mentors on shift that weekday × their daily cap). */
  async dashboard(days: number) {
    const today = this.todayIst();
    const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
    const [mentors, counts, next7] = await Promise.all([
      this.deps.db.mentor.findMany({ where: { isActive: true }, include: { rules: true } }),
      this.deps.db.booking.groupBy({ by: ["mentorLocalDate"], where: { status: "CONFIRMED", mentorLocalDate: { gte: dateOnly(dates[0]), lte: dateOnly(dates.at(-1)!) } }, _count: { _all: true } }),
      this.deps.db.booking.count({ where: { status: "CONFIRMED", startUtc: { gt: this.now(), lt: new Date(this.now().getTime() + 7 * 86_400_000) } } })
    ]);
    const booked = new Map(counts.map(c => [c.mentorLocalDate.toISOString().slice(0, 10), c._count._all]));
    const capacity = dates.map(istDate => {
      const cap = mentors.reduce((sum, m) => {
        const wd = localWeekday(zonedTime(istDate, 720, m.timezone).toJSDate(), m.timezone);
        return sum + (m.rules.some(r => r.weekday === wd) ? m.maxDailyTrials : 0);
      }, 0);
      return { istDate, booked: booked.get(istDate) ?? 0, capacity: cap };
    });
    return {
      today,
      todayCount: capacity[0]?.booked ?? 0,
      next7DaysCount: next7,
      capacity,
      fullyBookedIstDates: capacity.filter(c => c.capacity > 0 && c.booked >= c.capacity).map(c => c.istDate)
    };
  }

  async listBookings(f: BookingFilters) {
    const now = this.now();
    const q = f.q?.trim();
    const where: Prisma.BookingWhereInput = {
      ...(f.scope === "upcoming" ? { startUtc: { gt: now } } : f.scope === "past" ? { startUtc: { lte: now } } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.mentorId ? { mentorId: f.mentorId } : {}),
      ...(q ? { OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { childName: { contains: q, mode: "insensitive" } },
        { parent: { email: { contains: q, mode: "insensitive" } } },
        { parent: { name: { contains: q, mode: "insensitive" } } }
      ] } : {})
    };
    const [rows, total] = await Promise.all([
      this.deps.db.booking.findMany({ where, include, orderBy: { startUtc: f.scope === "past" ? "desc" : "asc" }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
      this.deps.db.booking.count({ where })
    ]);
    return { items: rows.map(b => this.bookings.toAdminDto(b)), total };
  }

  async bookingDetail(reference: string) {
    const b = await this.deps.db.booking.findUnique({ where: { reference }, include: { ...include, outbox: { orderBy: { createdAt: "asc" } } } });
    if (!b) throw notFound("We couldn't find this booking.");
    return { ...this.bookings.toAdminDto(b), messages: b.outbox.map(m => toOutboxDto({ ...m, booking: { reference } })) };
  }

  async cancel(reference: string) {
    return this.bookings.toAdminDto(await this.bookings.cancel(reference, { isAdmin: true }, "ADMIN"));
  }

  async listParents(q: string | undefined, page: number, pageSize: number) {
    const now = this.now();
    const where: Prisma.ParentWhereInput = q?.trim()
      ? { OR: [{ email: { contains: q.trim(), mode: "insensitive" } }, { name: { contains: q.trim(), mode: "insensitive" } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.deps.db.parent.findMany({ where, include: { bookings: { select: { status: true, startUtc: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.deps.db.parent.count({ where })
    ]);
    return {
      items: rows.map(p => ({
        id: p.id, name: p.name, email: p.email, phone: p.phone, timezone: p.timezone, status: accountStatus(p),
        bookingCount: p.bookings.length,
        upcomingCount: p.bookings.filter(b => b.status === "CONFIRMED" && b.startUtc > now).length
      })),
      total
    };
  }

  async parentDetail(id: string) {
    const p = await this.deps.db.parent.findUnique({ where: { id }, include: { bookings: { include, orderBy: { startUtc: "desc" } } } });
    if (!p) throw notFound("We couldn't find this parent.");
    return {
      parent: { id: p.id, name: p.name, email: p.email, phone: p.phone, timezone: p.timezone, status: accountStatus(p), createdAt: p.createdAt.toISOString() },
      bookings: p.bookings.map(b => this.bookings.toAdminDto(b))
    };
  }

  private weeklyShift(rules: { weekday: number; startMinute: number; endMinute: number }[]) {
    return [...rules].sort((a, b) => a.weekday - b.weekday).map(r => ({ weekday: r.weekday, start: formatClockMinutes(r.startMinute, true), end: formatClockMinutes(r.endMinute % 1440, true) }));
  }

  async listMentors() {
    const today = this.todayIst();
    const mentors = await this.deps.db.mentor.findMany({
      include: { rules: true, bookings: { where: { status: "CONFIRMED", startUtc: { gt: this.now() } }, select: { mentorLocalDate: true } } },
      orderBy: { name: "asc" }
    });
    return mentors.map(m => {
      const wd = localWeekday(zonedTime(today, 720, m.timezone).toJSDate(), m.timezone);
      return {
        id: m.id, name: m.name, email: m.email, bio: m.bio, shiftLabel: m.shiftLabel, timezone: m.timezone, maxDailyTrials: m.maxDailyTrials,
        weeklyShift: this.weeklyShift(m.rules),
        onShiftToday: m.rules.some(r => r.weekday === wd),
        todayBooked: m.bookings.filter(b => b.mentorLocalDate.toISOString().slice(0, 10) === today).length,
        upcomingCount: m.bookings.length
      };
    });
  }

  async mentorSchedule(id: string, from: string | undefined, days: number) {
    const m = await this.deps.db.mentor.findUnique({ where: { id }, include: { rules: true } });
    if (!m) throw notFound("We couldn't find this mentor.");
    const start = from ?? localDate(this.now(), m.timezone);
    const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
    const rows = await this.deps.db.booking.findMany({
      where: { mentorId: id, status: "CONFIRMED", mentorLocalDate: { gte: dateOnly(dates[0]), lte: dateOnly(dates.at(-1)!) } },
      include, orderBy: { startUtc: "asc" }
    });
    return {
      mentor: { id: m.id, name: m.name, bio: m.bio, shiftLabel: m.shiftLabel, timezone: m.timezone, maxDailyTrials: m.maxDailyTrials },
      weeklyShift: this.weeklyShift(m.rules),
      days: dates.map(d => {
        const wd = localWeekday(zonedTime(d, 720, m.timezone).toJSDate(), m.timezone);
        const list = rows.filter(b => b.mentorLocalDate.toISOString().slice(0, 10) === d);
        return { istDate: d, onShift: m.rules.some(r => r.weekday === wd), booked: list.length, max: m.maxDailyTrials, bookings: list.map(b => this.bookings.toAdminDto(b)) };
      })
    };
  }

  async outbox(page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      this.deps.db.outboxMessage.findMany({ include: { booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.deps.db.outboxMessage.count()
    ]);
    return { items: rows.map(toOutboxDto), total };
  }
}
