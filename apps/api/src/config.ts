import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/).transform(v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3)));
const bool = z.enum(["true", "false"]).transform(v => v === "true");

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(4000),
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email().default("admin@trialdesk.example"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin123!"),
  ADMIN_NAME: z.string().default("Ops Admin"),
  DEV_OUTBOX_ENABLED: bool.default("false"),
  PARENT_SESSION_DAYS: z.coerce.number().int().positive().default(7),
  ADMIN_SESSION_HOURS: z.coerce.number().int().positive().default(12),
  MIN_NOTICE_MINUTES: z.coerce.number().int().min(0).default(120),
  BOOKING_HORIZON_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  SLOT_STEP_MINUTES: z.coerce.number().int().positive().default(30),
  CLASS_DURATION_MINUTES: z.coerce.number().int().positive().default(60),
  DEFAULT_MAX_DAILY_TRIALS: z.coerce.number().int().positive().default(2),
  PARENT_HOURS_START: hhmm.default("08:00"),
  PARENT_HOURS_END: hhmm.default("21:00"),
  SUGGESTIONS_SAME_DAY: z.coerce.number().int().positive().default(4),
  SUGGESTIONS_SAME_TIME: z.coerce.number().int().positive().default(3),
  SUGGESTIONS_NEAREST: z.coerce.number().int().positive().default(4),
  MEETING_BASE_URL: z.string().url().default("https://meet.trialdesk.example/trial")
});

export type Config = ReturnType<typeof loadConfig>;

/** Parse env once at boot; invalid values fail fast with a readable message. */
export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(i => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    port: e.PORT,
    appBaseUrl: e.APP_BASE_URL.replace(/\/$/, ""),
    appSecret: e.APP_SECRET,
    admin: { email: e.ADMIN_EMAIL.toLowerCase(), password: e.ADMIN_PASSWORD, name: e.ADMIN_NAME },
    devOutboxEnabled: e.DEV_OUTBOX_ENABLED,
    parentSessionDays: e.PARENT_SESSION_DAYS,
    adminSessionHours: e.ADMIN_SESSION_HOURS,
    meetingBaseUrl: e.MEETING_BASE_URL.replace(/\/$/, ""),
    scheduling: {
      minNoticeMinutes: e.MIN_NOTICE_MINUTES,
      horizonDays: e.BOOKING_HORIZON_DAYS,
      stepMinutes: e.SLOT_STEP_MINUTES,
      durationMinutes: e.CLASS_DURATION_MINUTES,
      maxDailyTrials: e.DEFAULT_MAX_DAILY_TRIALS,
      parentStartMinute: e.PARENT_HOURS_START,
      parentEndMinute: e.PARENT_HOURS_END
    },
    suggestions: { sameDay: e.SUGGESTIONS_SAME_DAY, sameTime: e.SUGGESTIONS_SAME_TIME, nearest: e.SUGGESTIONS_NEAREST }
  };
}
