import { formatSlot } from "@trial/shared";
import { ArrowLeft, ArrowRight, Calculator, Code2, Info, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BookingForm, FormErrors } from "./validation";

export type ExistingTrial = { reference: string; startUtc: string; timezone: string };

export function DetailsForm({ form, setForm, errors, onSubmit, onBack, submitting, lockedEmail, existing, signedIn, banner }: {
  form: BookingForm; setForm: (f: BookingForm) => void; errors: FormErrors; onSubmit: () => void; onBack: () => void; submitting: boolean;
  lockedEmail: boolean; existing: ExistingTrial | null; signedIn: boolean; banner?: React.ReactNode;
}) {
  const set = (k: keyof BookingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const inv = (k: keyof BookingForm) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `f-${k}-error` } : {});
  return (
    <form className="flex min-w-0 flex-col gap-6 p-6" noValidate onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Your details</h2>
          <p className="text-[13px] text-muted-foreground">We'll send the class link and calendar invite to your email.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft />Back</Button>
      </div>
      {banner}
      {existing && (
        <Alert variant="info" icon={<Info />} title={`You already have a trial on ${formatSlot(existing.startUtc, existing.timezone)}`}>
          Each family can hold one upcoming free trial.{" "}
          {signedIn ? <Link className="font-medium underline underline-offset-4" to={`/booking/${existing.reference}`}>View booking</Link> : "Use the manage link in your confirmation email to change it."}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-[18px] sm:grid-cols-2">
        <Field id="f-name" label="Your name" error={errors.name}><Input id="f-name" autoComplete="name" placeholder="Jane Doe" value={form.name} onChange={set("name")} {...inv("name")} /></Field>
        <Field id="f-email" label="Email" error={errors.email} description={lockedEmail ? "Signed in. We use your account email." : undefined}>
          <Input id="f-email" type="email" autoComplete="email" placeholder="jane@example.com" value={form.email} onChange={set("email")} readOnly={lockedEmail} {...inv("email")} />
        </Field>
        <Field id="f-phone" label={<>Phone <span className="font-normal text-muted-foreground">(optional)</span></>} error={errors.phone} description="Only if the mentor can't connect.">
          <Input id="f-phone" type="tel" autoComplete="tel" placeholder="+1 555 010 2000" value={form.phone} onChange={set("phone")} {...inv("phone")} />
        </Field>
        <Field id="f-child" label="Child's first name" error={errors.child}><Input id="f-child" placeholder="Sam" value={form.child} onChange={set("child")} {...inv("child")} /></Field>
        <Field id="f-grade" label="Grade" error={errors.grade} className="sm:col-span-2">
          <NativeSelect id="f-grade" value={form.grade} onChange={set("grade")} {...inv("grade")}>
            <option value="">Select grade</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Grade {i + 1}</option>)}
          </NativeSelect>
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span id="subj-l" className={cn("text-sm font-medium", errors.subject && "text-destructive-text")}>Subject</span>
          <div role="group" aria-labelledby="subj-l" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {([["CODING", "Coding", "Scratch, Python, web and games", Code2], ["MATH", "Maths", "Number sense to algebra", Calculator]] as const).map(([v, t, d, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={form.subject === v}
                onClick={() => setForm({ ...form, subject: v })}
                className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-ring aria-pressed:border-brand aria-pressed:shadow-[0_0_0_3px_var(--brand-ring)]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted group-aria-pressed:bg-brand group-aria-pressed:text-white"><Icon className="size-4" /></span>
                <span><strong className="block font-semibold">{t}</strong><span className="text-[12.5px] text-muted-foreground">{d}</span></span>
              </button>
            ))}
          </div>
          {errors.subject && <p className="text-[13px] font-medium text-destructive-text">{errors.subject}</p>}
        </div>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" />Free. No payment details needed.</span>
        <Button type="submit" variant="brand" size="lg" disabled={submitting}>{submitting ? "Booking…" : <>Confirm booking <ArrowRight /></>}</Button>
      </div>
    </form>
  );
}
