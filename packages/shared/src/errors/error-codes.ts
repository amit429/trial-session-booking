export const ERROR_CODES = [
  "VALIDATION",
  "SLOT_TOO_SOON",
  "OUTSIDE_HOURS",
  "SLOT_UNAVAILABLE",
  "ACTIVE_TRIAL_EXISTS",
  "NOT_FOUND",
  "ALREADY_STARTED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_CREDENTIALS",
  "EMAIL_NOT_VERIFIED",
  "TOKEN_INVALID",
  "ORIGIN_MISMATCH",
  "RATE_LIMITED",
  "INTERNAL"
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** User-facing default messages (Technical Design §11.2). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Please check the highlighted fields.",
  SLOT_TOO_SOON: "This time is now too soon to book.",
  OUTSIDE_HOURS: "That time is outside our class hours.",
  SLOT_UNAVAILABLE: "That time was just booked.",
  ACTIVE_TRIAL_EXISTS: "You already have an upcoming trial.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  ALREADY_STARTED: "This class has already started and can't be cancelled.",
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have access to this page.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  EMAIL_NOT_VERIFIED: "Please verify your email first.",
  TOKEN_INVALID: "This link has expired. Request a new one.",
  ORIGIN_MISMATCH: "This request came from another site and was blocked.",
  RATE_LIMITED: "Too many attempts. Try again in a minute.",
  INTERNAL: "Something went wrong. Please try again."
};

export type ApiErrorBody = { error: { code: ErrorCode; message: string; details?: unknown } };
