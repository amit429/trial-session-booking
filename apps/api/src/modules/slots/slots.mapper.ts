import type { AvailabilityRule, Mentor } from "@prisma/client";
import { utcToDateOnly, type DaySlotsDto, type SlotDto, type Transition, type TransitionDto } from "@shared";
import type { Day, EngineBooking, EngineMentor, Slot } from "@/domain/scheduling/types";

export const toSlotDto = (s: Slot): SlotDto => ({
  startUtc: s.startUtc.toISOString(),
  endUtc: s.endUtc.toISOString(),
  status: s.status,
  availableMentors: s.availableMentors
});

export const toDayDto = (d: Day): DaySlotsDto => ({ date: d.date, status: d.status, slots: d.slots.map(toSlotDto) });

export const toTransitionDto = (t: Transition): TransitionDto => ({
  date: t.date,
  atUtc: t.at.toISOString(),
  fromOffset: t.fromOffset,
  toOffset: t.toOffset,
  back: t.back
});

export const toEngineMentor = (m: Mentor & { rules: AvailabilityRule[] }): EngineMentor => ({
  id: m.id,
  timezone: m.timezone,
  maxDailyTrials: m.maxDailyTrials,
  rules: m.rules.map(r => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))
});

export const toEngineBooking = (b: { mentorId: string; startUtc: Date; endUtc: Date; mentorLocalDate: Date }): EngineBooking => ({
  mentorId: b.mentorId,
  startUtc: b.startUtc,
  endUtc: b.endUtc,
  mentorLocalDate: utcToDateOnly(b.mentorLocalDate)
});
