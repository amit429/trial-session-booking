import { addDays, localDate, localDayWindow, upcomingTransitions, type DaySlotsDto, type SlotDto, type SlotsResponse } from "@shared";
import type { Deps } from "@/container";
import { buildSlots, type Day, type EngineBooking, type EngineConfig, type EngineMentor, type Slot } from "@/domain/scheduling/slot-engine";

export const toSlotDto = (s: Slot): SlotDto => ({
  startUtc: s.startUtc.toISOString(),
  endUtc: s.endUtc.toISOString(),
  status: s.status,
  availableMentors: s.availableMentors
});
export const toDayDto = (d: Day): DaySlotsDto => ({ date: d.date, status: d.status, slots: d.slots.map(toSlotDto) });

export class SlotService {
  constructor(private deps: Deps) {}

  get engineConfig(): EngineConfig {
    return this.deps.config.scheduling;
  }

  /** Active mentors with rules, and confirmed bookings around [from, to). Two queries. */
  async engineData(from: Date, to: Date, db = this.deps.db): Promise<{ mentors: EngineMentor[]; bookings: EngineBooking[] }> {
    const pad = 2 * 86_400_000;
    const [mentors, bookings] = await Promise.all([
      db.mentor.findMany({ where: { isActive: true }, include: { rules: true }, orderBy: { id: "asc" } }),
      db.booking.findMany({
        where: { status: "CONFIRMED", startUtc: { lt: new Date(to.getTime() + pad) }, endUtc: { gt: new Date(from.getTime() - pad) } },
        select: { mentorId: true, startUtc: true, endUtc: true, mentorLocalDate: true }
      })
    ]);
    return {
      mentors: mentors.map(m => ({
        id: m.id,
        timezone: m.timezone,
        maxDailyTrials: m.maxDailyTrials,
        rules: m.rules.map(r => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))
      })),
      bookings: bookings.map(b => ({ ...b, mentorLocalDate: b.mentorLocalDate.toISOString().slice(0, 10) }))
    };
  }

  today(tz: string) {
    return localDate(this.deps.clock.now(), tz);
  }

  async getDays(tz: string, fromDate?: string, days?: number): Promise<Day[]> {
    const today = this.today(tz);
    const from = !fromDate || fromDate < today ? today : fromDate;
    const n = days ?? this.engineConfig.horizonDays;
    const data = await this.engineData(localDayWindow(from, tz).start, localDayWindow(addDays(from, n), tz).start);
    return buildSlots({ parentTz: tz, fromDate: from, days: n, now: this.deps.clock.now(), config: this.engineConfig, ...data });
  }

  async slotsResponse(tz: string, fromDate?: string, days?: number): Promise<SlotsResponse> {
    const today = this.today(tz);
    const list = await this.getDays(tz, fromDate, days);
    const { horizonDays, minNoticeMinutes, durationMinutes } = this.engineConfig;
    return {
      timezone: tz,
      meta: { today, horizonDays, minNoticeMinutes, classDurationMinutes: durationMinutes },
      days: list.map(toDayDto),
      transitions: upcomingTransitions(tz, today, horizonDays).map(t => ({ date: t.date, atUtc: t.at.toISOString(), fromOffset: t.fromOffset, toOffset: t.toOffset, back: t.back }))
    };
  }
}
