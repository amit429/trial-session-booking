import type { AccountStatus, AdminBookingDto, OutboxDto } from "@shared";

export type Dashboard = { today: string; todayCount: number; next7DaysCount: number; capacity: { istDate: string; booked: number; capacity: number }[]; fullyBookedIstDates: string[] };
export type ParentRow = { id: string; name: string; email: string; phone: string | null; timezone: string; status: AccountStatus; bookingCount: number; upcomingCount: number };
export type ParentDetail = { parent: Omit<ParentRow, "bookingCount" | "upcomingCount"> & { createdAt: string }; bookings: AdminBookingDto[] };
export type Shift = { weekday: number; start: string; end: string };
export type MentorRow = { id: string; name: string; email: string; bio: string; shiftLabel: string; timezone: string; maxDailyTrials: number; weeklyShift: Shift[]; onShiftToday: boolean; todayBooked: number; upcomingCount: number };
export type MentorSchedule = { mentor: { id: string; name: string; bio: string; shiftLabel: string; timezone: string; maxDailyTrials: number }; weeklyShift: Shift[]; days: { istDate: string; onShift: boolean; booked: number; max: number; bookings: AdminBookingDto[] }[] };
export type BookingDetail = AdminBookingDto & { messages: OutboxDto[] };
export type Paged<T> = { items: T[]; total: number };
export const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const to12 = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
