import type { Parent } from "@prisma/client";
import { utcToDateOnly, type AccountStatus, type AdminBookingDto, type BookingDto, type CancelledBy } from "@shared";
import { googleCalendarUrl } from "./calendar";
import type { FullBooking } from "./bookings.repository";

export function accountStatus(p: Pick<Parent, "passwordHash" | "emailVerifiedAt">): AccountStatus {
  return !p.passwordHash ? "GUEST" : p.emailVerifiedAt ? "VERIFIED" : "PENDING";
}

export function toBookingDto(b: FullBooking, manageUrl?: string): BookingDto {
  return {
    reference: b.reference,
    status: b.status,
    startUtc: b.startUtc.toISOString(),
    endUtc: b.endUtc.toISOString(),
    parentTimezone: b.parentTimezone,
    mentorTimezone: b.mentorTimezone,
    meetingUrl: b.meetingUrl,
    ...(manageUrl ? { manageUrl } : {}),
    googleCalendarUrl: googleCalendarUrl({ ...b, mentorName: b.mentor.name }),
    subject: b.subject,
    child: { name: b.childName, grade: b.childGrade },
    parent: { name: b.parent.name, email: b.parent.email },
    parentAccount: accountStatus(b.parent),
    mentor: { id: b.mentor.id, name: b.mentor.name, bio: b.mentor.bio, shiftLabel: b.mentor.shiftLabel, timezone: b.mentor.timezone },
    cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
    cancelledBy: (b.cancelledBy as CancelledBy | null) ?? null,
    createdAt: b.createdAt.toISOString()
  };
}

export const toAdminBookingDto = (b: FullBooking, manageUrl?: string): AdminBookingDto => ({
  ...toBookingDto(b, manageUrl),
  id: b.id,
  mentorLocalDate: utcToDateOnly(b.mentorLocalDate),
  parentStatus: accountStatus(b.parent)
});
