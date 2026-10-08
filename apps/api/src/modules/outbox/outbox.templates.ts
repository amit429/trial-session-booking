import { formatSlot, subjectLabel } from "@shared";
import type { OutboxKind } from "@prisma/client";

/** Pure message builders (ADR-14). Bodies are rendered in the recipient's own zone. */

export type OutboxDraft = { kind: OutboxKind; toEmail: string; bookingId?: string; timezone?: string; subject: string; body: string };
export type BookingForMail = {
  id: string; reference: string; startUtc: Date; subject: string; childName: string; childGrade: number;
  parentTimezone: string; mentorTimezone: string; meetingUrl: string;
  parent: { name: string; email: string }; mentor: { name: string; email: string };
};

export function bookingConfirmed(b: BookingForMail, links: { manageUrl: string; signupUrl: string }): OutboxDraft[] {
  const subject = subjectLabel(b.subject);
  const parentTime = formatSlot(b.startUtc, b.parentTimezone);
  const mentorTime = formatSlot(b.startUtc, b.mentorTimezone);
  return [
    {
      kind: "BOOKING_CONFIRMED_PARENT", toEmail: b.parent.email, bookingId: b.id, timezone: b.parentTimezone,
      subject: `Your free ${subject} trial is confirmed`,
      body: `Hi ${b.parent.name}, your free ${subject} trial for ${b.childName} is confirmed for ${parentTime} with ${b.mentor.name}.\nJoin: ${b.meetingUrl}\nManage your booking: ${links.manageUrl}\nWant to see all your bookings in one place? Create an account: ${links.signupUrl}`
    },
    {
      kind: "BOOKING_CONFIRMED_MENTOR", toEmail: b.mentor.email, bookingId: b.id, timezone: b.mentorTimezone,
      subject: `New trial: ${b.childName}, ${mentorTime}`,
      body: `New trial: ${b.childName} (Grade ${b.childGrade}, ${subject}) on ${mentorTime}.\nParent's time: ${parentTime} (${b.parent.name}).\nJoin: ${b.meetingUrl}`
    }
  ];
}

export function bookingCancelled(b: BookingForMail, by: "PARENT" | "ADMIN", bookUrl: string): OutboxDraft[] {
  const extra = by === "ADMIN" ? " by our team" : "";
  return [
    {
      kind: "BOOKING_CANCELLED_PARENT", toEmail: b.parent.email, bookingId: b.id, timezone: b.parentTimezone,
      subject: "Your trial was cancelled",
      body: `Your trial for ${b.childName} on ${formatSlot(b.startUtc, b.parentTimezone)} was cancelled${extra}.\nBook another time: ${bookUrl}`
    },
    {
      kind: "BOOKING_CANCELLED_MENTOR", toEmail: b.mentor.email, bookingId: b.id, timezone: b.mentorTimezone,
      subject: `Trial cancelled: ${b.childName}`,
      body: `The trial with ${b.childName} on ${formatSlot(b.startUtc, b.mentorTimezone)} was cancelled${extra}. The slot is free again.`
    }
  ];
}

export const verifyEmail = (email: string, name: string, verifyUrl: string): OutboxDraft => ({
  kind: "VERIFY_EMAIL", toEmail: email, subject: "Verify your email",
  body: `Hi ${name}, confirm this is your email to see your bookings.\nVerify: ${verifyUrl}\nThis link works for 24 hours.`
});

export const accountExists = (email: string, loginUrl: string, forgotUrl: string): OutboxDraft => ({
  kind: "ACCOUNT_EXISTS", toEmail: email, subject: "You already have an account",
  body: `Someone tried to sign up with this email. You already have an account.\nSign in: ${loginUrl}\nForgot your password? ${forgotUrl}`
});

export const resetPassword = (email: string, resetUrl: string): OutboxDraft => ({
  kind: "RESET_PASSWORD", toEmail: email, subject: "Reset your password",
  body: `Use this link to set a new password. It works for 1 hour.\nReset: ${resetUrl}`
});
