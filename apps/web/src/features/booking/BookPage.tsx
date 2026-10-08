import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatSlot, localClockMinutes, localDate, type BookingDto, type SlotDto, type SlotsResponse, type SuggestionsResponse } from "@shared";
import { Globe, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "@/components/SiteHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ApiError, api, appPath } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTimezone } from "@/lib/useTimezone";
import { cn } from "@/lib/utils";
import { DetailsForm, type ExistingTrial } from "./DetailsForm";
import { InfoPane } from "./InfoPane";
import { MonthCalendar } from "./MonthCalendar";
import { Suggestions } from "./Suggestions";
import { TimesPane } from "./TimesPane";
import { mapServerErrors, validateBooking, type BookingForm, type FormErrors } from "./validation";

const EMPTY: BookingForm = { name: "", email: "", phone: "", child: "", grade: "", subject: "" };
const SLOT_ERRORS = { SLOT_UNAVAILABLE: "That time was just booked", SLOT_TOO_SOON: "This time is now too soon to book", OUTSIDE_HOURS: "That time is outside class hours" } as const;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** PRD §5 journey: pick a day and time in local time → details → atomic booking → confirmation. */
export function BookPage() {
  const { tz, setTz, isDetected } = useTimezone();
  const { parent } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [date, setDate] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [h24, setH24] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<BookingForm>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [existing, setExisting] = useState<ExistingTrial | null>(null);
  const [fullPick, setFullPick] = useState<SlotDto | null>(null);
  const [raceSugg, setRaceSugg] = useState<{ data: SuggestionsResponse; lead: string } | null>(null);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (parent) setForm(f => ({ ...f, name: f.name || parent.name, email: parent.email }));
  }, [parent]);

  const slotsQ = useQuery({
    queryKey: ["slots", tz],
    queryFn: () => api.get<SlotsResponse>("/slots", { tz: tz! }),
    enabled: !!tz,
    staleTime: 30_000
  });
  const days = useMemo(() => new Map((slotsQ.data?.days ?? []).map(d => [d.date, d])), [slotsQ.data]);

  // Default to the first day with an open time; keep the calendar month in sync.
  useEffect(() => {
    if (!slotsQ.data) return;
    if (!date || !days.has(date)) {
      const first = slotsQ.data.days.find(d => d.status === "OPEN") ?? slotsQ.data.days[0];
      if (first) { setDate(first.date); setMonth(first.date.slice(0, 7)); }
    }
  }, [slotsQ.data, days, date]);

  const day = date ? days.get(date) : undefined;
  const fullDay = day?.status === "FULL";
  const suggTarget = fullPick ?? (fullDay && day ? day.slots[Math.floor(day.slots.length / 2)] : null);
  const suggQ = useQuery({
    queryKey: ["suggestions", tz, suggTarget?.startUtc],
    queryFn: () => api.get<SuggestionsResponse>("/slots/suggestions", { tz: tz!, date: localDate(suggTarget!.startUtc, tz!), time: hhmm(localClockMinutes(suggTarget!.startUtc, tz!)) }),
    enabled: !!tz && !!suggTarget && step === 1
  });

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

  const book = useMutation({
    mutationFn: (body: unknown) => api.post<BookingDto>("/bookings", body, { "Idempotency-Key": idemKey }),
    onSuccess: b => {
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["me-bookings"] });
      toast.success("Trial booked", { description: `${formatSlot(b.startUtc, b.parentTimezone)} with ${b.mentor.name}` });
      navigate(appPath(b.manageUrl!), { state: { justBooked: true } });
    },
    onError: (err: unknown) => {
      qc.invalidateQueries({ queryKey: ["slots"] });
      if (!(err instanceof ApiError)) return toast.error("Something went wrong. Please try again.");
      if (err.code in SLOT_ERRORS && err.details?.suggestions) {
        setRaceSugg({ data: err.details.suggestions, lead: SLOT_ERRORS[err.code as keyof typeof SLOT_ERRORS] });
        return;
      }
      if (err.code === "ACTIVE_TRIAL_EXISTS") return setExisting(err.details as ExistingTrial);
      if (err.code === "VALIDATION") return setErrors(mapServerErrors(err.details?.fieldErrors));
      toast.error(err.message);
    }
  });

  const submit = () => {
    if (!tz || !selected) return;
    const r = validateBooking(form, selected, tz);
    setExisting(null);
    setRaceSugg(null);
    if (!r.ok) {
      setErrors(r.errors);
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return;
    }
    setErrors({});
    book.mutate(r.body);
  };

  const transition = slotsQ.data?.transitions[0];
  const info = (
    <InfoPane tz={tz} setTz={z => { setTz(z); setDate(null); setFullPick(null); }} isDetected={isDetected} transition={transition} h24={h24}
      picked={step === 2 ? selected : null} onChangeTime={() => { setStep(1); setRaceSugg(null); }} />
  );
  const shell = (cols: string, children: React.ReactNode) => (
    <div className={cn("grid min-h-[540px] overflow-hidden rounded-2xl border border-border bg-card shadow-md max-[960px]:grid-cols-1 [&>*+*]:border-t [&>*+*]:border-border min-[961px]:[&>*+*]:border-l min-[961px]:[&>*+*]:border-t-0", cols)}>
      {children}
    </div>
  );
  const footer = <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" />No payment and no account needed. You can cancel any time before the class.</p>;

  if (!tz) {
    return <PublicLayout>{shell("min-[961px]:grid-cols-[300px_minmax(0,1fr)]", <>{info}<EmptyState icon={<Globe />} title="Choose your time zone to see class times"><p className="text-[13px] text-muted-foreground">Times are always shown in your local time.</p></EmptyState></>)}</PublicLayout>;
  }

  if (step === 2 && selected) {
    return (
      <PublicLayout>
        {shell("min-[961px]:grid-cols-[300px_minmax(0,1fr)]", <>
          {info}
          <DetailsForm
            form={form} setForm={f => { setForm(f); }} errors={errors} onSubmit={submit} onBack={() => { setStep(1); setRaceSugg(null); }}
            submitting={book.isPending} lockedEmail={!!parent} existing={existing} signedIn={!!parent}
            banner={raceSugg && <Suggestions tz={tz} data={raceSugg.data} lead={raceSugg.lead} onPick={pickSlot} h24={h24} />}
          />
        </>)}
        {footer}
      </PublicLayout>
    );
  }

  if (slotsQ.isError) {
    return (
      <PublicLayout>
        <Alert variant="destructive" title="We couldn't load class times">
          Check your connection and try again. <Button variant="link" onClick={() => slotsQ.refetch()}>Retry</Button>
        </Alert>
      </PublicLayout>
    );
  }

  const noneOpen = slotsQ.data && !slotsQ.data.days.some(d => d.status === "OPEN");
  const override = suggTarget
    ? suggQ.data
      ? <Suggestions tz={tz} data={suggQ.data} onPick={pickSlot} onBack={fullPick ? () => setFullPick(null) : undefined} h24={h24} />
      : <div className="flex flex-col gap-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
    : undefined;

  return (
    <PublicLayout>
      {!slotsQ.data || !date || !month || !day ? (
        shell("min-[961px]:grid-cols-[300px_minmax(0,1fr)_284px]", <>
          {info}
          <div className="flex flex-col gap-4 p-6" aria-busy="true" aria-label="Loading class times">
            <div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-[72px]" /></div>
            <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="aspect-square max-h-[58px] rounded-[9px]" />)}</div>
          </div>
          <div className="flex flex-col gap-2 p-6">
            <div className="mb-2 flex justify-between"><Skeleton className="h-5 w-20" /><Skeleton className="h-8 w-24" /></div>
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[42px] rounded-[9px]" />)}
          </div>
        </>)
      ) : noneOpen ? (
        shell("min-[961px]:grid-cols-[300px_minmax(0,1fr)]", <>{info}<div className="p-6"><Suggestions tz={tz} data={{ strategy: "NONE", requested: { date, time: "09:00", timezone: tz }, suggestions: [], notes: [] }} onPick={pickSlot} /></div></>)
      ) : (
        shell("min-[961px]:grid-cols-[300px_minmax(0,1fr)_284px]", <>
          {info}
          <MonthCalendar
            tz={tz} month={month} days={days} selected={date} today={slotsQ.data.meta.today}
            onPick={d => { setDate(d); setFullPick(null); }}
            onMonth={delta => { const [y, m] = month.split("-").map(Number); setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)); }}
          />
          <TimesPane tz={tz} day={day} h24={h24} setH24={setH24} onPick={s => pickSlot(s.startUtc)} onFull={setFullPick} activeFull={fullPick?.startUtc} override={override} />
        </>)
      )}
      {footer}
    </PublicLayout>
  );
}
