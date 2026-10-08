import type { MentorPublicDto } from "./mentor.model";
import type { AccountStatus } from "./parent.model";
import type { Subject } from "./subject.model";

export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type CancelledBy = "PARENT" | "ADMIN";

export type BookingDto = {
  reference: string;
  status: BookingStatus;
  startUtc: string;
  endUtc: string;
  parentTimezone: string;
  mentorTimezone: string;
  meetingUrl: string;
  /** Private manage link; present for the creator, the token holder, the owner and admins. */
  manageUrl?: string;
  googleCalendarUrl: string;
  subject: Subject;
  child: { name: string; grade: number };
  parent: { name: string; email: string };
  /** Whether the booking's email has an account: decides if "create an account" is offered. */
  parentAccount: AccountStatus;
  mentor: MentorPublicDto;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  createdAt: string;
};

/** Error details for ACTIVE_TRIAL_EXISTS. */
export type ExistingTrialDto = { reference: string; startUtc: string; timezone: string };
