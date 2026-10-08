import type { WeeklyRule } from "@shared";

/** Inputs and outputs of the pure availability engine (Technical Design §8). */

export type EngineConfig = {
  minNoticeMinutes: number;
  horizonDays: number;
  stepMinutes: number;
  durationMinutes: number;
  maxDailyTrials: number;
  parentStartMinute: number;
  parentEndMinute: number;
};
export type EngineMentor = { id: string; timezone: string; maxDailyTrials: number; rules: WeeklyRule[] };
export type EngineBooking = { mentorId: string; startUtc: Date; endUtc: Date; mentorLocalDate: string };
export type SlotStatus = "OPEN" | "FULL";
export type Slot = { startUtc: Date; endUtc: Date; status: SlotStatus; availableMentors: number; availableMentorIds: string[] };
export type DayStatus = "OPEN" | "FULL" | "CLOSED";
export type Day = { date: string; status: DayStatus; slots: Slot[] };
export type EngineInput = {
  parentTz: string;
  fromDate: string;
  days: number;
  now: Date;
  config: EngineConfig;
  mentors: EngineMentor[];
  bookings: EngineBooking[];
};

