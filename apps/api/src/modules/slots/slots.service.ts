import { addDays, localDate, localDayWindow, upcomingTransitions, type SlotsResponse } from "@shared";
import type { Deps } from "@/container";
import type { DbClient } from "@/core/types";
import { buildSlots } from "@/domain/scheduling/slot-engine";
import type { Day, EngineBooking, EngineConfig, EngineMentor } from "@/domain/scheduling/types";
import { toDayDto, toEngineBooking, toEngineMentor, toTransitionDto } from "./slots.mapper";
import type { SlotsRepository } from "./slots.repository";

export type EngineData = { mentors: EngineMentor[]; bookings: EngineBooking[] };

/** Loads availability data (two queries) and runs the pure slot engine for a parent's zone. */
export class SlotService {
  constructor(private deps: Deps, private repo: SlotsRepository) {}

  get engineConfig(): EngineConfig {
    return this.deps.config.scheduling;
  }

  async engineData(from: Date, to: Date, client?: DbClient): Promise<EngineData> {
    const [mentors, bookings] = await Promise.all([this.repo.activeMentorsWithRules(client), this.repo.confirmedAround(from, to, client)]);
    return { mentors: mentors.map(toEngineMentor), bookings: bookings.map(toEngineBooking) };
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
      transitions: upcomingTransitions(tz, today, horizonDays).map(toTransitionDto)
    };
  }
}
