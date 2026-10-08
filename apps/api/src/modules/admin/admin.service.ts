import type { Prisma } from "@prisma/client";
import {
  DAY_MS,
  MENTOR_TIMEZONE,
  addDays,
  dateOnlyToUtc,
  localDate,
  utcToDateOnly,
  type AdminBookingDetailDto,
  type AdminBookingDto,
  type AdminDashboardDto,
  type AdminMentorDto,
  type AdminParentDetailDto,
  type AdminParentRowDto,
  type MentorScheduleDto,
  type Paged
} from "@shared";
import type { Deps } from "@/container";
import { notFound } from "@/http/errors";
import { accountStatus, toAdminBookingDto, type BookingService } from "@/modules/bookings";
import { toOutboxDto } from "@/modules/outbox";
import type { ParentsRepository } from "@/modules/parents";
import { isOnShift, toWeeklyShift } from "./admin.mapper";
import type { AdminRepository } from "./admin.repository";

export type BookingFilters = {
  scope: "upcoming" | "past" | "all";
  status?: "CONFIRMED" | "CANCELLED";
  mentorId?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export class AdminService {
  constructor(
    private deps: Deps,
    private repo: AdminRepository,
    private parents: ParentsRepository,
    private bookings: BookingService
  ) {}

  private now() {
    return this.deps.clock.now();
  }
  private todayIst() {
    return localDate(this.now(), MENTOR_TIMEZONE);
  }
  private adminDto = (b: Parameters<typeof toAdminBookingDto>[0]) => toAdminBookingDto(b, this.bookings.manageUrl(b));

  /** Load per India date: booked vs capacity (mentors on shift that weekday × their daily cap). */
  async dashboard(days: number): Promise<AdminDashboardDto> {
    const today = this.todayIst();
    const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
    const now = this.now();
    const [mentors, counts, next7] = await Promise.all([
      this.repo.activeMentorsWithRules(),
      this.repo.confirmedCountsByMentorDate(dateOnlyToUtc(dates[0]), dateOnlyToUtc(dates[dates.length - 1])),
      this.repo.countConfirmedStarting(now, new Date(now.getTime() + 7 * DAY_MS))
    ]);
    const booked = new Map(counts.map(c => [utcToDateOnly(c.mentorLocalDate), c._count._all]));
    const capacity = dates.map(istDate => ({
      istDate,
      booked: booked.get(istDate) ?? 0,
      capacity: mentors.reduce((sum, m) => sum + (isOnShift(m, istDate) ? m.maxDailyTrials : 0), 0)
    }));
    return {
      today,
      todayCount: capacity[0]?.booked ?? 0,
      next7DaysCount: next7,
      capacity,
      fullyBookedIstDates: capacity.filter(c => c.capacity > 0 && c.booked >= c.capacity).map(c => c.istDate)
    };
  }

  async listBookings(f: BookingFilters): Promise<Paged<AdminBookingDto>> {
    const now = this.now();
    const q = f.q?.trim();
    const where: Prisma.BookingWhereInput = {
      ...(f.scope === "upcoming" ? { startUtc: { gt: now } } : f.scope === "past" ? { startUtc: { lte: now } } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.mentorId ? { mentorId: f.mentorId } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { childName: { contains: q, mode: "insensitive" } },
              { parent: { email: { contains: q, mode: "insensitive" } } },
              { parent: { name: { contains: q, mode: "insensitive" } } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.repo.searchBookings(where, f.scope === "past" ? "desc" : "asc", f.page, f.pageSize);
    return { items: rows.map(this.adminDto), total };
  }

  async bookingDetail(reference: string): Promise<AdminBookingDetailDto> {
    const b = await this.repo.bookingWithMessages(reference);
    if (!b) throw notFound("We couldn't find this booking.");
    return { ...this.adminDto(b), messages: b.outbox.map(m => toOutboxDto({ ...m, booking: { reference } })) };
  }

  async cancel(reference: string): Promise<AdminBookingDto> {
    return this.adminDto(await this.bookings.cancel(reference, { isAdmin: true }, "ADMIN"));
  }

  async listParents(q: string | undefined, page: number, pageSize: number): Promise<Paged<AdminParentRowDto>> {
    const term = q?.trim();
    const where: Prisma.ParentWhereInput = term
      ? { OR: [{ email: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] }
      : {};
    const [rows, total] = await this.parents.search(where, page, pageSize);
    const now = this.now();
    return {
      items: rows.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        timezone: p.timezone,
        status: accountStatus(p),
        bookingCount: p.bookings.length,
        upcomingCount: p.bookings.filter(b => b.status === "CONFIRMED" && b.startUtc > now).length
      })),
      total
    };
  }

  async parentDetail(id: string): Promise<AdminParentDetailDto> {
    const p = await this.parents.findWithBookings(id);
    if (!p) throw notFound("We couldn't find this parent.");
    return {
      parent: {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        timezone: p.timezone,
        status: accountStatus(p),
        createdAt: p.createdAt.toISOString()
      },
      bookings: p.bookings.map(this.adminDto)
    };
  }

  async listMentors(): Promise<AdminMentorDto[]> {
    const today = this.todayIst();
    const mentors = await this.repo.mentorsWithUpcoming(this.now());
    return mentors.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      bio: m.bio,
      shiftLabel: m.shiftLabel,
      timezone: m.timezone,
      maxDailyTrials: m.maxDailyTrials,
      weeklyShift: toWeeklyShift(m.rules),
      onShiftToday: isOnShift(m, today),
      todayBooked: m.bookings.filter(b => utcToDateOnly(b.mentorLocalDate) === today).length,
      upcomingCount: m.bookings.length
    }));
  }

  async mentorSchedule(id: string, from: string | undefined, days: number): Promise<MentorScheduleDto> {
    const m = await this.repo.mentorWithRules(id);
    if (!m) throw notFound("We couldn't find this mentor.");
    const start = from ?? localDate(this.now(), m.timezone);
    const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
    const rows = await this.repo.confirmedForMentorBetweenDates(id, dateOnlyToUtc(dates[0]), dateOnlyToUtc(dates[dates.length - 1]));
    return {
      mentor: { id: m.id, name: m.name, bio: m.bio, shiftLabel: m.shiftLabel, timezone: m.timezone, maxDailyTrials: m.maxDailyTrials },
      weeklyShift: toWeeklyShift(m.rules),
      days: dates.map(d => {
        const list = rows.filter(b => utcToDateOnly(b.mentorLocalDate) === d);
        return { istDate: d, onShift: isOnShift(m, d), booked: list.length, max: m.maxDailyTrials, bookings: list.map(this.adminDto) };
      })
    };
  }
}
