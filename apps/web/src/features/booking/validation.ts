import { CreateBookingRequest } from "@shared";

export type BookingForm = { name: string; email: string; phone: string; child: string; grade: string; subject: string };
export type FormErrors = Partial<Record<keyof BookingForm, string>>;

const FIELD: Record<string, keyof BookingForm> = {
  "parent.name": "name", "parent.email": "email", "parent.phone": "phone", "child.name": "child", "child.grade": "grade", subject: "subject"
};

/** Validate with the same zod schema the API uses, mapped onto form fields. */
export function validateBooking(f: BookingForm, startUtc: string, timezone: string) {
  const raw = {
    parent: { name: f.name, email: f.email, phone: f.phone || undefined },
    child: { name: f.child, grade: f.grade === "" ? undefined : Number(f.grade) },
    subject: f.subject || undefined,
    startUtc,
    timezone
  };
  const r = CreateBookingRequest.safeParse(raw);
  if (r.success) return { ok: true as const, body: r.data };
  const errors: FormErrors = {};
  for (const issue of r.error.issues) {
    const key = FIELD[issue.path.join(".")];
    if (key && !errors[key]) errors[key] = key === "grade" ? "Choose a grade between 1 and 12" : issue.message;
  }
  return { ok: false as const, errors };
}

/** Server field errors ("parent.email") → form keys. */
export function mapServerErrors(fieldErrors: Record<string, string> | undefined): FormErrors {
  const out: FormErrors = {};
  for (const [k, v] of Object.entries(fieldErrors ?? {})) if (FIELD[k]) out[FIELD[k]] = v;
  return out;
}
