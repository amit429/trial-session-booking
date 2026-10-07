import { Prisma, type Booking, type Mentor, type Parent } from "@prisma/client";
import {
  localClockMinutes,
  localDate,
  type AccountStatus,
  type AdminBookingDto,
  type BookingDto,
  type CreateBookingRequest
} from "@trial/shared";
import type { Deps } from "../container";
import { rankMentors } from "../domain/assignment";
import { meetingSuffix, newReference } from "../domain/reference";
import { availableMentorsAt, horizonEnd, isInParentWindow, staffedMentorsAt } from "../domain/slotEngine";
import { manageToken, verifyManageToken } from "../domain/tokens";
import { AppError, notFound } from "../http/errors";
import { googleCalendarUrl } from "./calendarService";
import type { OutboxService } from "./outboxService";
import type { SlotService } from "./slotService";
import type { SuggestionService } from "./suggestionService";

export type FullBooking = Booking & { mentor: Mentor; parent: Parent };
export type Viewer = { token?: string; parentId?: string; isAdmin?: boolean };

/** Thrown inside a candidate's transaction to roll it back and try the next mentor. */
class TryNextMentor extends Error {}
/** A concurrent request with the same idempotency key committed first. */
class AlreadyCreated extends Error {}

const TX = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 15_000 };
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export function accountStatus(p: Pick<Parent, "passwordHash" | "emailVerifiedAt">): AccountStatus {
  return !p.passwordHash ? "GUEST" : p.emailVerifiedAt ? "VERIFIED" : "PENDING";
}

export class BookingService {
  constructor(
    private deps: Deps,
    private slots: SlotService,
    private suggestions: SuggestionService,
    private outbox: OutboxService
  ) {}

  manageUrl(b: Pick<Booking, "id" | "reference">) {
    return `${this.deps.config.appBaseUrl}/booking/${b.reference}?token=${manageToken(this.deps.config.appSecret, b.id)}`;
  }

  toDto(b: FullBooking, withManage = true): BookingDto {
    return {
      reference: b.reference,
      status: b.status,
      startUtc: b.startUtc.toISOString(),
      endUtc: b.endUtc.toISOString(),
      parentTimezone: b.parentTimezone,
      mentorTimezone: b.mentorTimezone,
      meetingUrl: b.meetingUrl,
      ...(withManage ? { manageUrl: this.manageUrl(b) } : {}),
      googleCalendarUrl: googleCalendarUrl({ ...b, mentorName: b.mentor.name }),
      subject: b.subject,
      child: { name: b.childName, grade: b.childGrade },
      parent: { name: b.parent.name, email: b.parent.email },
      mentor: { id: b.mentor.id, name: b.mentor.name, bio: b.mentor.bio, shiftLabel: b.mentor.shiftLabel, timezone: b.mentor.timezone },
      cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
      cancelledBy: (b.cancelledBy as "PARENT" | "ADMIN" | null) ?? null,
      createdAt: b.createdAt.toISOString()
    };
  }

  toAdminDto(b: FullBooking): AdminBookingDto {
    return { ...this.toDto(b), id: b.id, mentorLocalDate: isoDate(b.mentorLocalDate), parentStatus: accountStatus(b.parent) };
  }

  private async slotError(code: "SLOT_TOO_SOON" | "OUTSIDE_HOURS" | "SLOT_UNAVAILABLE", start: Date, tz: string) {
    const suggestions = await this.suggestions.suggest(tz, localDate(start, tz), localClockMinutes(start, tz), start);
    return new AppError(code, code === "SLOT_UNAVAILABLE" ? 409 : 422, undefined, { suggestions });
  }

  private findByKey(key: string) {
    return this.deps.db.booking.findUnique({ where: { idempotencyKey: key }, include: { mentor: true, parent: true } });
  }

  /** Atomic create (Technical Design §9.1). One short transaction per candidate mentor (ADR-8). */
  async create(req: CreateBookingRequest, idempotencyKey: string, sessionEmail?: string): Promise<BookingDto> {
    const replay = await this.findByKey(idempotencyKey);
    if (replay) return this.toDto(replay);

    if (sessionEmail && sessionEmail !== req.parent.email) {
      throw new AppError("VALIDATION", 422, "Please use your account email.", { fieldErrors: { "parent.email": "Please use your account email" } });
    }

    const { config, clock } = this.deps;
    const cfg = config.scheduling;
    const tz = req.timezone;
    const start = new Date(req.startUtc);
    const end = new Date(start.getTime() + cfg.durationMinutes * 60_000);
    const now = clock.now();

    if (start >= horizonEnd(tz, now, cfg)) {
      throw new AppError("VALIDATION", 422, undefined, { fieldErrors: { startUtc: "Please pick a time from the list" } });
    }
    if (start.getTime() < now.getTime() + cfg.minNoticeMinutes * 60_000) throw await this.slotError("SLOT_TOO_SOON", start, tz);

    const data = await this.slots.engineData(start, end);
    if (!isInParentWindow(start, tz, cfg) || !staffedMentorsAt(start, data.mentors, cfg).length) {
      throw await this.slotError("OUTSIDE_HOURS", start, tz);
    }

    const candidates = rankMentors(availableMentorsAt(start, data.mentors, data.bookings, cfg), start, { ...data, config: cfg, now });

    for (const candidate of candidates) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const booking = await this.deps.db.$transaction(async tx => {
            // Parent: create if new, then lock. Same-email requests serialize here.
            await tx.$executeRaw`INSERT INTO "Parent" (id, name, email, phone, timezone, "createdAt")
              VALUES (gen_random_uuid(), ${req.parent.name}, ${req.parent.email}, ${req.parent.phone ?? null}, ${tz}, now())
              ON CONFLICT (email) DO NOTHING`;
            const [parent] = await tx.$queryRaw<{ id: string; passwordHash: string | null }[]>`
              SELECT id::text, "passwordHash" FROM "Parent" WHERE email = ${req.parent.email} FOR UPDATE`;
            if (await tx.booking.findUnique({ where: { idempotencyKey }, select: { id: true } })) throw new AlreadyCreated();
            const active = await tx.booking.findFirst({
              where: { parentId: parent.id, status: "CONFIRMED", startUtc: { gt: now } },
              orderBy: { startUtc: "asc" }
            });
            if (active) {
              throw new AppError("ACTIVE_TRIAL_EXISTS", 409, undefined, { reference: active.reference, startUtc: active.startUtc.toISOString(), timezone: active.parentTimezone });
            }
            if (!parent.passwordHash) {
              await tx.parent.update({ where: { id: parent.id }, data: { name: req.parent.name, phone: req.parent.phone ?? null, timezone: tz } });
            }

            // Mentor: lock, then re-check against committed state.
            await tx.$queryRaw`SELECT id FROM "Mentor" WHERE id = ${candidate.id}::uuid FOR UPDATE`;
            const mentorDate = localDate(start, candidate.timezone);
            const [overlap, dayCount] = await Promise.all([
              tx.booking.count({ where: { mentorId: candidate.id, status: "CONFIRMED", startUtc: { lt: end }, endUtc: { gt: start } } }),
              tx.booking.count({ where: { mentorId: candidate.id, status: "CONFIRMED", mentorLocalDate: dateOnly(mentorDate) } })
            ]);
            if (overlap > 0 || dayCount >= candidate.maxDailyTrials) throw new TryNextMentor();

            const reference = newReference();
            const created = await tx.booking.create({
              data: {
                reference,
                parentId: parent.id,
                mentorId: candidate.id,
                childName: req.child.name,
                childGrade: req.child.grade,
                subject: req.subject,
                startUtc: start,
                endUtc: end,
                mentorLocalDate: dateOnly(mentorDate),
                parentTimezone: tz,
                mentorTimezone: candidate.timezone,
                meetingUrl: `${config.meetingBaseUrl}/${reference}-${meetingSuffix()}`,
                idempotencyKey
              },
              include: { mentor: true, parent: true }
            });
            await this.outbox.bookingConfirmed(tx, created, this.manageUrl(created));
            return created;
          }, TX);
          return this.toDto(booking);
        } catch (err) {
          if (err instanceof TryNextMentor) break;
          if (err instanceof AlreadyCreated) return this.toDto((await this.findByKey(idempotencyKey))!);
          if (err instanceof AppError) throw err;
          const text = `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
          if (text.includes("booking_no_overlap_per_mentor") || text.includes("23P01")) break;
          if (text.includes("idempotencyKey")) {
            const winner = await this.findByKey(idempotencyKey);
            if (winner) return this.toDto(winner);
          }
          if (text.includes("reference")) continue; // reference collision: new reference, same mentor
          throw err;
        }
      }
    }
    throw await this.slotError("SLOT_UNAVAILABLE", start, tz);
  }

  /** Booking visible to a token holder, its verified owner, or an admin. Anything else is 404. */
  async getForViewer(reference: string, viewer: Viewer): Promise<FullBooking> {
    const b = await this.deps.db.booking.findUnique({ where: { reference }, include: { mentor: true, parent: true } });
    if (!b) throw notFound("We couldn't find this booking.");
    const ok =
      viewer.isAdmin ||
      (viewer.token && verifyManageToken(this.deps.config.appSecret, b.id, viewer.token)) ||
      (viewer.parentId && viewer.parentId === b.parentId && !!b.parent.emailVerifiedAt);
    if (!ok) throw notFound("We couldn't find this booking.");
    return b;
  }

  async cancel(reference: string, viewer: Viewer, by: "PARENT" | "ADMIN"): Promise<FullBooking> {
    const b = await this.getForViewer(reference, viewer);
    if (b.status === "CANCELLED") return b;
    if (b.startUtc <= this.deps.clock.now()) throw new AppError("ALREADY_STARTED", 422);
    return this.deps.db.$transaction(async tx => {
      const updated = await tx.booking.update({
        where: { id: b.id },
        data: { status: "CANCELLED", cancelledAt: this.deps.clock.now(), cancelledBy: by },
        include: { mentor: true, parent: true }
      });
      await this.outbox.bookingCancelled(tx, updated, by);
      return updated;
    }, TX);
  }
}
