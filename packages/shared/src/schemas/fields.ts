import { z } from "zod";
import { GRADE_MAX, GRADE_MIN, SLOT_STEP_MINUTES } from "../constants";
import { isValidZone, normalizeZone } from "../time/zones";

/** Reusable field schemas. Messages are user-facing and shared by the API and the forms. */

export const emailField = z
  .string({ required_error: "Please enter a valid email" })
  .trim()
  .toLowerCase()
  .max(254, "Please enter a valid email")
  .email("Please enter a valid email");

export const timezoneField = z
  .string({ required_error: "Please choose your time zone" })
  .refine(isValidZone, "Please choose your time zone")
  .transform(normalizeZone);

export const passwordField = z
  .string({ required_error: "Use at least 8 characters" })
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const tokenField = z.string().min(1).max(200);

export const isoDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** An ISO-8601 UTC instant on the class grid (whole minutes, :00 or :30). */
export const gridInstantField = z.string({ required_error: "Please pick a time from the list" }).refine(v => {
  const d = new Date(v);
  return (
    /Z$/.test(v) &&
    !Number.isNaN(d.getTime()) &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0 &&
    d.getUTCMinutes() % SLOT_STEP_MINUTES === 0
  );
}, "Please pick a time from the list");

const gradeMessage = `Choose a grade between ${GRADE_MIN} and ${GRADE_MAX}`;
export const gradeField = z.coerce
  .number({ invalid_type_error: gradeMessage })
  .int(gradeMessage)
  .min(GRADE_MIN, gradeMessage)
  .max(GRADE_MAX, gradeMessage);
