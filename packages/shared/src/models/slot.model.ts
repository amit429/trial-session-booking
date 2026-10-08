export type SlotStatus = "OPEN" | "FULL";
export type DayStatus = "OPEN" | "FULL" | "CLOSED";

export type SlotDto = { startUtc: string; endUtc: string; status: SlotStatus; availableMentors: number };
export type DaySlotsDto = { date: string; status: DayStatus; slots: SlotDto[] };
export type TransitionDto = { date: string; atUtc: string; fromOffset: number; toOffset: number; back: boolean };

export type SlotsResponse = {
  timezone: string;
  meta: { today: string; horizonDays: number; minNoticeMinutes: number; classDurationMinutes: number };
  days: DaySlotsDto[];
  transitions: TransitionDto[];
};
