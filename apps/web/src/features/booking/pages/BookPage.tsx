import { formatSlot, localDate, type BookingDto, type ExistingTrialDto, type SlotDto, type SuggestionsResponse } from "@shared";
import { Globe, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { appPath, errorMessage, isApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/session";
import { useTimezone } from "@/hooks/useTimezone";
import { cn } from "@/lib/utils";
import { useCreateBooking, useSlots, useSuggestions } from "../api/booking.api";
import { DetailsForm } from "../components/DetailsForm";
import { InfoPane } from "../components/InfoPane";
import { MonthCalendar } from "../components/MonthCalendar";
import { Suggestions } from "../components/Suggestions";
import { TimesPane } from "../components/TimesPane";
import { mapServerErrors, validateBooking, type BookingForm, type FormErrors } from "../utils/validation";

const EMPTY: BookingForm = { name: "", email: "", phone: "", child: "", grade: "", subject: "" };
const SUBJECT_PARAMS = new Set(["CODING", "MATH"]);
const SLOT_ERRORS = {
  SLOT_UNAVAILABLE: "That time was just booked",
  SLOT_TOO_SOON: "This time is now too soon to book",
  OUTSIDE_HOURS: "That time is outside class hours"
} as const;
type SlotErrorCode = keyof typeof SLOT_ERRORS;
const isSlotError = (code: string): code is SlotErrorCode => code in SLOT_ERRORS;

/** PRD §5 journey: pick a day and time in local time → details → atomic booking → confirmation. */
export function BookPage() {
  const { tz, setTz, isDetected } = useTimezone();
  const { parent } = useAuth();
  const navigate = useNavigate();

  const [pickedDate, setDate] = useState<string | null>(null);
  const [pickedMonth, setMonth] = useState<string | null>(null);
  const [h24, setH24] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [params] = useSearchParams();
  const presetSubject = params.get("subject");
  const [form, setForm] = useState<BookingForm>(() => ({
    ...EMPTY,
    subject: presetSubject && SUBJECT_PARAMS.has(presetSubject) ? presetSubject : ""
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [existing, setExisting] = useState<ExistingTrialDto | null>(null);
  const [fullPick, setFullPick] = useState<SlotDto | null>(null);
  const [raceSugg, setRaceSugg] = useState<{ data: SuggestionsResponse; lead: string } | null>(null);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  // Signed-in parents book with their account email; their name pre-fills until they type another.
  const formValues = parent ? { ...form, name: form.name || parent.name, email: parent.email } : form;

  const slotsQ = useSlots(tz);
  const days = useMemo(() => new Map((slotsQ.data?.days ?? []).map(d => [d.date, d])), [slotsQ.data]);

  // Until the parent picks a day, show the first day with an open time (derived, not synced via an effect).
  const firstOpen = slotsQ.data ? ((slotsQ.data.days.find(d => d.status === "OPEN") ?? slotsQ.data.days[0])?.date ?? null) : null;
  const date = pickedDate && days.has(pickedDate) ? pickedDate : firstOpen;
  const month = pickedMonth ?? date?.slice(0, 7) ?? null;

  const day = date ? days.get(date) : undefined;
  const fullDay = day?.status === "FULL";
  const suggTarget = fullPick ?? (fullDay && day ? day.slots[Math.floor(day.slots.length / 2)] : null);
  const suggQ = useSuggestions(tz, suggTarget?.startUtc ?? null, step === 1);

  const pickSlot = (startUtc: string) => {
    if (!tz) return;
    setSelected(startUtc);
    setDate(localDate(startUtc, tz));
    setMonth(localDate(startUtc, tz).slice(0, 7));
    setStep(2);
    setFullPick(null);
    setRaceSugg(null);
    setExisting(null);
    setIdemKey(crypto.randomUUID());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const book = useCreateBooking(idemKey);
  const onBooked = (b: BookingDto) => {
    toast.success("Trial booked", { description: `${formatSlot(b.startUtc, b.parentTimezone)} with ${b.mentor.name}` });
    navigate(appPath(b.manageUrl ?? `/booking/${b.reference}`), { state: { justBooked: true } });
  };
  /** Lost races and invalid times show alternatives in place; the form keeps what the parent typed. */
  const onBookingError = (err: unknown) => {
    if (!isApiError(err)) return toast.error(errorMessage(err));
    if (isSlotError(err.code) && err.details.suggestions)
      return setRaceSugg({ data: err.details.suggestions, lead: SLOT_ERRORS[err.code] });
    if (err.code === "ACTIVE_TRIAL_EXISTS" && err.details.reference && err.details.startUtc && err.details.timezone) {
      return setExisting({ reference: err.details.reference, startUtc: err.details.startUtc, timezone: err.details.timezone });
    }
    if (err.code === "VALIDATION") return setErrors(mapServerErrors(err.details.fieldErrors));
    toast.error(err.message);
  };

  const submit = () => {
    if (!tz || !selected) return;
    const r = validateBooking(formValues, selected, tz);
    setExisting(null);
    setRaceSugg(null);
    if (!r.ok) {
      setErrors(r.errors);
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return;
    }
    setErrors({});
    book.mutate(r.body, { onSuccess: onBooked, onError: onBookingError });
  };

  const transition = slotsQ.data?.transitions[0];
  const info = (
    <InfoPane
      tz={tz}
      setTz={z => {
        setTz(z);
        setDate(null);
        setMonth(null);
        setFullPick(null);
      }}
      isDetected={isDetected}
      transition={transition}
      h24={h24}
      picked={step === 2 ? selected : null}
      onChangeTime={() => {
        setStep(1);
        setRaceSugg(null);
      }}
    />
  );
  const shell = (cols: string, children: React.ReactNode) => (
    <div
      className={cn(
        "grid min-h-[540px] overflow-hidden rounded-2xl border border-border bg-card shadow-md max-[960px]:grid-cols-1 [&>*+*]:border-t [&>*+*]:border-border min-[961px]:[&>*+*]:border-l min-[961px]:[&>*+*]:border-t-0",
        cols
      )}
    >
      {children}
    </div>
  );
  const footer = (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5" />
      No payment and no account needed. You can cancel any time before the class.
    </p>
  );

  if (!tz) {
    return (
      <PublicLayout>
        {shell(
          "min-[961px]:grid-cols-[300px_minmax(0,1fr)]",
          <>
            {info}
            <EmptyState icon={<Globe />} title="Choose your time zone to see class times">
              <p className="text-[13px] text-muted-foreground">Times are always shown in your local time.</p>
            </EmptyState>
          </>
        )}
      </PublicLayout>
    );
  }

  if (step === 2 && selected) {
    return (
      <PublicLayout>
        {shell(
          "min-[961px]:grid-cols-[300px_minmax(0,1fr)]",
          <>
            {info}
            <DetailsForm
              form={formValues}
              setForm={setForm}
              errors={errors}
              onSubmit={submit}
              onBack={() => {
                setStep(1);
                setRaceSugg(null);
              }}
              submitting={book.isPending}
              lockedEmail={!!parent}
              existing={existing}
              signedIn={!!parent}
              banner={raceSugg && <Suggestions tz={tz} data={raceSugg.data} lead={raceSugg.lead} onPick={pickSlot} h24={h24} />}
            />
          </>
        )}
        {footer}
      </PublicLayout>
    );
  }

  if (slotsQ.isError) {
    return (
      <PublicLayout>
        <Alert variant="destructive" title="We couldn't load class times">
          Check your connection and try again.{" "}
          <Button variant="link" onClick={() => slotsQ.refetch()}>
            Retry
          </Button>
        </Alert>
      </PublicLayout>
    );
  }

  const noneOpen = slotsQ.data && !slotsQ.data.days.some(d => d.status === "OPEN");
  const override = suggTarget ? (
    suggQ.data ? (
      <Suggestions tz={tz} data={suggQ.data} onPick={pickSlot} onBack={fullPick ? () => setFullPick(null) : undefined} h24={h24} />
    ) : (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  ) : undefined;

  return (
    <PublicLayout>
      {!slotsQ.data || !date || !month || !day
        ? shell(
            "min-[961px]:grid-cols-[300px_minmax(0,1fr)_284px]",
            <>
              {info}
              <div className="flex flex-col gap-4 p-6" aria-busy="true" aria-label="Loading class times">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-8 w-[72px]" />
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }, (_, i) => (
                    <Skeleton key={i} className="aspect-square max-h-[58px] rounded-[9px]" />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 p-6">
                <div className="mb-2 flex justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-[42px] rounded-[9px]" />
                ))}
              </div>
            </>
          )
        : noneOpen
          ? shell(
              "min-[961px]:grid-cols-[300px_minmax(0,1fr)]",
              <>
                {info}
                <div className="p-6">
                  <Suggestions
                    tz={tz}
                    data={{ strategy: "NONE", requested: { date, time: "09:00", timezone: tz }, suggestions: [], notes: [] }}
                    onPick={pickSlot}
                  />
                </div>
              </>
            )
          : shell(
              "min-[961px]:grid-cols-[300px_minmax(0,1fr)_284px]",
              <>
                {info}
                <MonthCalendar
                  tz={tz}
                  month={month}
                  days={days}
                  selected={date}
                  today={slotsQ.data.meta.today}
                  onPick={d => {
                    setDate(d);
                    setFullPick(null);
                  }}
                  onMonth={delta => {
                    const [y, m] = month.split("-").map(Number);
                    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
                  }}
                />
                <TimesPane
                  tz={tz}
                  day={day}
                  h24={h24}
                  setH24={setH24}
                  onPick={s => pickSlot(s.startUtc)}
                  onFull={setFullPick}
                  activeFull={fullPick?.startUtc}
                  override={override}
                />
              </>
            )}
      {footer}
    </PublicLayout>
  );
}
