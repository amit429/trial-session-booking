import { z } from "zod";
import { isValidZone, normalizeZone } from "./time/zones";

const email = z
  .string({ required_error: "Please enter a valid email" })
  .trim()
  .toLowerCase()
  .max(254, "Please enter a valid email")
  .email("Please enter a valid email");

const timezone = z
  .string({ required_error: "Please choose your time zone" })
  .refine(isValidZone, "Please choose your time zone")
  .transform(normalizeZone);

const password = z
  .string({ required_error: "Use at least 8 characters" })
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

const gridInstant = z
  .string({ required_error: "Please pick a time from the list" })
  .refine(v => {
    const d = new Date(v);
    return /Z$/.test(v) && !Number.isNaN(d.getTime()) && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 30 === 0;
  }, "Please pick a time from the list");

export const Subject = z.enum(["CODING", "MATH"], { errorMap: () => ({ message: "Choose a subject" }) });
export type Subject = z.infer<typeof Subject>;

export const CreateBookingRequest = z.object({
  parent: z.object({
    name: z.string({ required_error: "Please enter your name" }).trim().min(2, "Please enter your name").max(80, "Please enter your name"),
    email,
    phone: z
      .string()
      .trim()
      .optional()
      .transform(v => (v ? v : undefined))
      .refine(v => v === undefined || /^\+?[0-9 ()-]{7,20}$/.test(v), "Please enter a valid phone number")
  }),
  child: z.object({
    name: z.string({ required_error: "Please enter your child's name" }).trim().min(1, "Please enter your child's name").max(60, "Please enter your child's name"),
    grade: z.coerce
      .number({ invalid_type_error: "Choose a grade between 1 and 12" })
      .int("Choose a grade between 1 and 12")
      .min(1, "Choose a grade between 1 and 12")
      .max(12, "Choose a grade between 1 and 12")
  }),
  subject: Subject,
  startUtc: gridInstant,
  timezone
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequest>;

export const SignupRequest = z
  .object({ name: z.string().trim().min(2, "Please enter your name").max(80), email, password })
  .refine(v => v.password.toLowerCase() !== v.email, { message: "Password can't be your email", path: ["password"] });
export const LoginRequest = z.object({ email, password: z.string().min(1, "Please enter your password") });
export const EmailRequest = z.object({ email });
export const TokenRequest = z.object({ token: z.string().min(1).max(200) });
export const ResetPasswordRequest = z.object({ token: z.string().min(1).max(200), password });
export const CancelRequest = z.object({ token: z.string().max(200).optional() });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const SlotsQuery = z.object({
  tz: timezone,
  from: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(14).default(14)
});
export const SuggestionsQuery = z.object({
  tz: timezone,
  date: isoDate,
  time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, "Use HH:mm on the half hour")
});

/* ---------- response DTOs ---------- */
export type SlotStatus = "OPEN" | "FULL";
export type SlotDto = { startUtc: string; endUtc: string; status: SlotStatus; availableMentors: number };
export type DayStatus = "OPEN" | "FULL" | "CLOSED";
export type DaySlotsDto = { date: string; status: DayStatus; slots: SlotDto[] };
export type TransitionDto = { date: string; atUtc: string; fromOffset: number; toOffset: number; back: boolean };
export type SlotsResponse = {
  timezone: string;
  meta: { today: string; horizonDays: number; minNoticeMinutes: number; classDurationMinutes: number };
  days: DaySlotsDto[];
  transitions: TransitionDto[];
};
export type SuggestionStrategy = "SAME_DAY" | "SAME_TIME" | "NEAREST" | "NONE";
export type SuggestionsResponse = {
  strategy: SuggestionStrategy;
  requested: { date: string; time: string; timezone: string };
  suggestions: SlotDto[];
  notes: { type: "DST_SHIFT"; message: string }[];
};
export type MentorPublicDto = { id: string; name: string; bio: string; shiftLabel: string; timezone: string };
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type BookingDto = {
  reference: string;
  status: BookingStatus;
  startUtc: string;
  endUtc: string;
  parentTimezone: string;
  mentorTimezone: string;
  meetingUrl: string;
  manageUrl?: string;
  googleCalendarUrl: string;
  subject: Subject;
  child: { name: string; grade: number };
  parent: { name: string; email: string };
  mentor: MentorPublicDto;
  cancelledAt: string | null;
  cancelledBy: "PARENT" | "ADMIN" | null;
  createdAt: string;
};
export type AccountStatus = "GUEST" | "PENDING" | "VERIFIED";
export type ParentDto = { id: string; name: string; email: string; timezone: string; status: AccountStatus };
export type AdminDto = { id: string; name: string; email: string };
export type MeResponse = { parent: ParentDto | null; admin: AdminDto | null };
export type AdminBookingDto = BookingDto & { id: string; mentorLocalDate: string; parentStatus: AccountStatus };
export type OutboxDto = { id: string; kind: string; toEmail: string; subject: string; body: string; bookingReference: string | null; createdAt: string };
export type Paged<T> = { items: T[]; total: number };
