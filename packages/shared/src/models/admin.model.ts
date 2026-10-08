import type { BookingDto } from "./booking.model";
import type { MentorPublicDto, WeeklyShiftDto } from "./mentor.model";
import type { OutboxDto } from "./outbox.model";
import type { AccountStatus } from "./parent.model";

export type AdminBookingDto = BookingDto & { id: string; mentorLocalDate: string; parentStatus: AccountStatus };
export type AdminBookingDetailDto = AdminBookingDto & { messages: OutboxDto[] };

export type CapacityDayDto = { istDate: string; booked: number; capacity: number };
export type AdminDashboardDto = {
  today: string;
  todayCount: number;
  next7DaysCount: number;
  capacity: CapacityDayDto[];
  fullyBookedIstDates: string[];
};

export type AdminParentDto = { id: string; name: string; email: string; phone: string | null; timezone: string; status: AccountStatus };
export type AdminParentRowDto = AdminParentDto & { bookingCount: number; upcomingCount: number };
export type AdminParentDetailDto = { parent: AdminParentDto & { createdAt: string }; bookings: AdminBookingDto[] };

export type AdminMentorDto = MentorPublicDto & {
  email: string;
  maxDailyTrials: number;
  weeklyShift: WeeklyShiftDto[];
  onShiftToday: boolean;
  todayBooked: number;
  upcomingCount: number;
};
export type MentorScheduleDayDto = { istDate: string; onShift: boolean; booked: number; max: number; bookings: AdminBookingDto[] };
export type MentorScheduleDto = {
  mentor: MentorPublicDto & { maxDailyTrials: number };
  weeklyShift: WeeklyShiftDto[];
  days: MentorScheduleDayDto[];
};
