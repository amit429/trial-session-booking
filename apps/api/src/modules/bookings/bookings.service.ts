import type { Prisma } from "@prisma/client";
import { MINUTE_MS, dateOnlyToUtc, localClockMinutes, localDate, type BookingDto, type CreateBookingRequest } from "@shared";
import type { Deps } from "@/container";
import { meetingSuffix, newReference } from "@/domain/booking/reference";
import { rankMentors } from "@/domain/scheduling/assignment";
import { availableMentorsAt, horizonEnd, isInParentWindow, staffedMentorsAt } from "@/domain/scheduling/slot-engine";
import type { EngineMentor } from "@/domain/scheduling/types";
import { manageToken } from "@/domain/security/tokens";
import { AppError, notFound } from "@/http/errors";
import type { OutboxService } from "@/modules/outbox";
import type { SlotService, SuggestionService } from "@/modules/slots";
import { canView, type Viewer } from "./booking-access";
import { toBookingDto } from "./bookings.mapper";
import { classEnd, type BookingsRepository, type FullBooking } from "./bookings.repository";

/** Roll back this candidate's transaction and try the next mentor. */
class TryNextMentor extends Error {}
/** A concurrent request with the same idempotency key committed first. */
class AlreadyCreated extends Error {}

type SlotErrorCode = "SLOT_TOO_SOON" | "OUTSIDE_HOURS" | "SLOT_UNAVAILABLE";
const MAX_REFERENCE_RETRIES = 3;

const isOverlapViolation = (err: unknown) => /booking_no_overlap_per_mentor|23P01/.test(describe(err));
const isUniqueViolationOn = (err: unknown, field: string) => describe(err).includes("P2002") && describe(err).includes(field);
function describe(err: unknown) {
  const e = err as { code?: string; message?: string; meta?: unknown };
  return `${e?.code ?? ""} ${e?.message ?? ""} ${JSON.stringify(e?.meta ?? {})}`;
}

export class BookingService {
  constructor(
    private deps: Deps,
    private repo: BookingsRepository,
    private slots: SlotService,
    private suggestions: SuggestionService,
    private outbox: OutboxService
  ) {}

  manageUrl(b: { id: string; reference: string }) {
    return `${this.deps.config.appBaseUrl}/booking/${b.reference}?token=${manageToken(this.deps.config.appSecret, b.id)}`;
  }

  toDto(b: FullBooking): BookingDto {
    return toBookingDto(b, this.manageUrl(b));
  }

  /** Atomic create (Technical Design §9.1): validate the time, then one short transaction per candidate mentor (ADR-8). */
  async create(req: CreateBookingRequest, idempotencyKey: string, sessionEmail?: string): Promise<BookingDto> {
    const replay = await this.repo.findByIdempotencyKey(idempotencyKey);
    if (replay) return this.toDto(replay);
    if (sessionEmail && sessionEmail !== req.parent.email) {
      throw new AppError("VALIDATION", 422, "Please use your account email.", { fieldErrors: { "parent.email": "Please use your account email" } });
    }

    const start = new Date(req.startUtc);
    const candidates = await this.rankedCandidates(start, req.timezone);
    for (const mentor of candidates) {
      const outcome = await this.tryMentor(mentor, start, req, idempotencyKey);
      if (outcome) return this.toDto(outcome);
    }
    throw await this.slotError("SLOT_UNAVAILABLE", start, req.timezone);
  }

  /** Checks the time is bookable at all, then orders the mentors who are free (least loaded first). */
  private async rankedCandidates(start: Date, tz: string): Promise<EngineMentor[]> {
    const cfg = this.deps.config.scheduling;
    const now = this.deps.clock.now();
    if (start >= horizonEnd(tz, now, cfg)) {
      throw new AppError("VALIDATION", 422, undefined, { fieldErrors: { startUtc: "Please pick a time from the list" } });
    }
    if (start.getTime() < now.getTime() + cfg.minNoticeMinutes * MINUTE_MS) throw await this.slotError("SLOT_TOO_SOON", start, tz);

    const data = await this.slots.engineData(start, classEnd(start, cfg.durationMinutes));
    if (!isInParentWindow(start, tz, cfg) || !staffedMentorsAt(start, data.mentors, cfg).length) {
      throw await this.slotError("OUTSIDE_HOURS", start, tz);
    }
    return rankMentors(availableMentorsAt(start, data.mentors, data.bookings, cfg), start, { ...data, config: cfg, now });
  }

  /** One candidate: the booking, or null to try the next mentor. Throws ACTIVE_TRIAL_EXISTS. */
  private async tryMentor(mentor: EngineMentor, start: Date, req: CreateBookingRequest, idempotencyKey: string): Promise<FullBooking | null> {
    for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
      try {
        return await this.repo.transaction(tx => this.bookInTransaction(tx, mentor, start, req, idempotencyKey));
      } catch (err) {
        if (err instanceof TryNextMentor || isOverlapViolation(err)) return null;
        if (err instanceof AlreadyCreated || isUniqueViolationOn(err, "idempotencyKey")) {
          const winner = await this.repo.findByIdempotencyKey(idempotencyKey);
          if (winner) return winner;
        }
        if (isUniqueViolationOn(err, "reference")) continue;
        throw err;
      }
    }
    return null;
  }

  private async bookInTransaction(tx: Prisma.TransactionClient, mentor: EngineMentor, start: Date, req: CreateBookingRequest, idempotencyKey: string) {
    const { config, clock } = this.deps;
    const now = clock.now();
    const end = classEnd(start, config.scheduling.durationMinutes);
    const contact = { ...req.parent, timezone: req.timezone };

    const parent = await this.repo.lockParent(tx, contact);
    if (await this.repo.findByIdempotencyKey(idempotencyKey, tx)) throw new AlreadyCreated();
    const active = await this.repo.findUpcomingForParent(tx, parent.id, now);
    if (active) {
      throw new AppError("ACTIVE_TRIAL_EXISTS", 409, undefined, { reference: active.reference, startUtc: active.startUtc.toISOString(), timezone: active.parentTimezone });
    }
    await this.repo.updateParentContact(tx, parent.id, contact, !parent.passwordHash);

    await this.repo.lockMentor(tx, mentor.id);
    const mentorDate = dateOnlyToUtc(localDate(start, mentor.timezone));
    const [overlap, dayCount] = await Promise.all([
      this.repo.countOverlapping(tx, mentor.id, start, end),
      this.repo.countOnMentorDate(tx, mentor.id, mentorDate)
    ]);
    if (overlap > 0 || dayCount >= mentor.maxDailyTrials) throw new TryNextMentor();

    const reference = newReference();
    const created = await this.repo.create(tx, {
      reference,
      parentId: parent.id,
      mentorId: mentor.id,
      childName: req.child.name,
      childGrade: req.child.grade,
      subject: req.subject,
      startUtc: start,
      endUtc: end,
      mentorLocalDate: mentorDate,
      parentTimezone: req.timezone,
      mentorTimezone: mentor.timezone,
      meetingUrl: `${config.meetingBaseUrl}/${reference}-${meetingSuffix()}`,
      idempotencyKey
    });
    await this.outbox.bookingConfirmed(tx, created, this.manageUrl(created));
    return created;
  }

  private async slotError(code: SlotErrorCode, start: Date, tz: string) {
    const suggestions = await this.suggestions.suggest(tz, localDate(start, tz), localClockMinutes(start, tz), start);
    return new AppError(code, code === "SLOT_UNAVAILABLE" ? 409 : 422, undefined, { suggestions });
  }

  /** The booking if this viewer may see it; otherwise 404 (never 403, so existence isn't revealed). */
  async getForViewer(reference: string, viewer: Viewer): Promise<FullBooking> {
    const b = await this.repo.findByReference(reference);
    if (!b || !canView(b, viewer, this.deps.config.appSecret)) throw notFound("We couldn't find this booking.");
    return b;
  }

  async cancel(reference: string, viewer: Viewer, by: "PARENT" | "ADMIN"): Promise<FullBooking> {
    const b = await this.getForViewer(reference, viewer);
    if (b.status === "CANCELLED") return b;
    const now = this.deps.clock.now();
    if (b.startUtc <= now) throw new AppError("ALREADY_STARTED", 422);
    const cancelled = await this.repo.transaction(async tx => {
      const updated = await this.repo.cancelIfConfirmed(tx, b.id, by, now);
      if (updated) await this.outbox.bookingCancelled(tx, updated, by);
      return updated;
    });
    return cancelled ?? (await this.getForViewer(reference, viewer));
  }

  async listForParent(parentId: string, scope: "upcoming" | "past" | "all"): Promise<BookingDto[]> {
    return (await this.repo.listForParent(parentId, scope, this.deps.clock.now())).map(b => this.toDto(b));
  }
}
