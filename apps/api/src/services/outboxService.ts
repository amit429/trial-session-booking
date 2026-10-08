import { formatSlot } from "@shared";
import type { Prisma } from "@prisma/client";
import type { Deps } from "../container";
import type { Db } from "../db";

type Tx = Db | Prisma.TransactionClient;
type BookingForMail = {
  id: string; reference: string; startUtc: Date; subject: string; childName: string; childGrade: number;
  parentTimezone: string; mentorTimezone: string; meetingUrl: string;
  parent: { name: string; email: string }; mentor: { name: string; email: string };
};
const subj = (s: string) => (s === "CODING" ? "Coding" : "Maths");

/** Stores every message the system would email (ADR-14). Bodies are rendered in the recipient's zone. */
export class OutboxService {
  constructor(private deps: Deps) {}

  private url = (path: string) => `${this.deps.config.appBaseUrl}${path}`;

  async bookingConfirmed(tx: Tx, b: BookingForMail, manageUrl: string) {
    const parentTime = formatSlot(b.startUtc, b.parentTimezone);
    const mentorTime = formatSlot(b.startUtc, b.mentorTimezone);
    await tx.outboxMessage.createMany({
      data: [
        {
          kind: "BOOKING_CONFIRMED_PARENT", toEmail: b.parent.email, bookingId: b.id, timezone: b.parentTimezone,
          subject: `Your free ${subj(b.subject)} trial is confirmed`,
          body: `Hi ${b.parent.name}, your free ${subj(b.subject)} trial for ${b.childName} is confirmed for ${parentTime} with ${b.mentor.name}.\nJoin: ${b.meetingUrl}\nManage your booking: ${manageUrl}\nWant to see all your bookings in one place? Create an account: ${this.url("/signup")}`
        },
        {
          kind: "BOOKING_CONFIRMED_MENTOR", toEmail: b.mentor.email, bookingId: b.id, timezone: b.mentorTimezone,
          subject: `New trial: ${b.childName}, ${mentorTime}`,
          body: `New trial: ${b.childName} (Grade ${b.childGrade}, ${subj(b.subject)}) on ${mentorTime}.\nParent's time: ${parentTime} (${b.parent.name}).\nJoin: ${b.meetingUrl}`
        }
      ]
    });
  }

  async bookingCancelled(tx: Tx, b: BookingForMail, by: "PARENT" | "ADMIN") {
    const extra = by === "ADMIN" ? " by our team" : "";
    await tx.outboxMessage.createMany({
      data: [
        {
          kind: "BOOKING_CANCELLED_PARENT", toEmail: b.parent.email, bookingId: b.id, timezone: b.parentTimezone,
          subject: "Your trial was cancelled",
          body: `Your trial for ${b.childName} on ${formatSlot(b.startUtc, b.parentTimezone)} was cancelled${extra}.\nBook another time: ${this.url("/book")}`
        },
        {
          kind: "BOOKING_CANCELLED_MENTOR", toEmail: b.mentor.email, bookingId: b.id, timezone: b.mentorTimezone,
          subject: `Trial cancelled: ${b.childName}`,
          body: `The trial with ${b.childName} on ${formatSlot(b.startUtc, b.mentorTimezone)} was cancelled${extra}. The slot is free again.`
        }
      ]
    });
  }

  async verifyEmail(email: string, name: string, token: string) {
    await this.deps.db.outboxMessage.create({
      data: { kind: "VERIFY_EMAIL", toEmail: email, subject: "Verify your email", body: `Hi ${name}, confirm this is your email to see your bookings.\nVerify: ${this.url(`/verify-email?token=${token}`)}\nThis link works for 24 hours.` }
    });
  }

  async accountExists(email: string) {
    await this.deps.db.outboxMessage.create({
      data: { kind: "ACCOUNT_EXISTS", toEmail: email, subject: "You already have an account", body: `Someone tried to sign up with this email. You already have an account.\nSign in: ${this.url("/login")}\nForgot your password? ${this.url("/forgot-password")}` }
    });
  }

  async resetPassword(email: string, token: string) {
    await this.deps.db.outboxMessage.create({
      data: { kind: "RESET_PASSWORD", toEmail: email, subject: "Reset your password", body: `Use this link to set a new password. It works for 1 hour.\nReset: ${this.url(`/reset-password?token=${token}`)}` }
    });
  }
}
