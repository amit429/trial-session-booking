import { z } from "zod";
import { SUBJECTS } from "../models/subject.model";
import { emailField, gradeField, gridInstantField, timezoneField, tokenField } from "./fields";

export const SubjectSchema = z.enum(SUBJECTS, { errorMap: () => ({ message: "Choose a subject" }) });

export const CreateBookingRequest = z.object({
  parent: z.object({
    name: z.string({ required_error: "Please enter your name" }).trim().min(2, "Please enter your name").max(80, "Please enter your name"),
    email: emailField,
    phone: z
      .string()
      .trim()
      .optional()
      .transform(v => (v ? v : undefined))
      .refine(v => v === undefined || /^\+?[0-9 ()-]{7,20}$/.test(v), "Please enter a valid phone number")
  }),
  child: z.object({
    name: z.string({ required_error: "Please enter your child's name" }).trim().min(1, "Please enter your child's name").max(60, "Please enter your child's name"),
    grade: gradeField
  }),
  subject: SubjectSchema,
  startUtc: gridInstantField,
  timezone: timezoneField
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequest>;

export const CancelRequest = z.object({ token: tokenField.optional() });
export type CancelRequest = z.infer<typeof CancelRequest>;
