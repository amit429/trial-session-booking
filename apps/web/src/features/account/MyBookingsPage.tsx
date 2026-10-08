import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDayLong, formatSlot, formatTime, zoneAbbreviation, type BookingDto } from "@shared";
import { CalendarDays, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Busy, ListSkeleton } from "@/components/skeletons";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Tabs } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subjectLabel } from "@/lib/utils";

export function StatusBadge({ b }: { b: Pick<BookingDto, "status" | "startUtc"> }) {
  if (b.status === "CANCELLED") return <Badge variant="destructive" dot>Cancelled</Badge>;
  if (new Date(b.startUtc) <= new Date()) return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="success" dot>Confirmed</Badge>;
}

export function DateBox({ iso, tz }: { iso: string; tz: string }) {
  const local = new Date(iso);
  return (
    <div className="w-[52px] overflow-hidden rounded-lg border border-border bg-background text-center" aria-hidden>
      <div className="bg-muted py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: tz }).format(local)}</div>
      <div className="pb-1.5 pt-0.5 text-[19px] font-semibold tabular-nums">{new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(local)}</div>
    </div>
  );
}

export function MyBookingsPage() {
  const { parent } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [toCancel, setToCancel] = useState<BookingDto | null>(null);
  const q = useQuery({ queryKey: ["me-bookings"], queryFn: () => api.get<BookingDto[]>("/me/bookings", { scope: "all" }) });
  const cancel = useMutation({
    mutationFn: (ref: string) => api.post<BookingDto>(`/bookings/${ref}/cancel`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); setToCancel(null); toast.success("Trial cancelled"); },
    onError: e => { setToCancel(null); toast.error(e instanceof ApiError ? e.message : "Something went wrong."); }
  });

  const now = new Date();
  const all = q.data ?? [];
  const upcoming = all.filter(b => b.status === "CONFIRMED" && new Date(b.startUtc) > now).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const past = all.filter(b => !(b.status === "CONFIRMED" && new Date(b.startUtc) > now)).sort((a, b) => b.startUtc.localeCompare(a.startUtc));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <PublicLayout narrow>
      <div className="mb-6 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-semibold">My bookings</h1>
          <Button asChild variant="brand"><Link to="/book"><Sparkles />Book a trial</Link></Button>
        </div>
        <p className="text-muted-foreground">Every trial booked with {parent?.email}, including ones from before you signed up.</p>
      </div>
      <div className="flex flex-col gap-4">
        <Tabs label="Bookings" value={tab} onChange={setTab} className="self-start" items={[
          { value: "upcoming", label: <>Upcoming <span className="text-muted-foreground">{upcoming.length}</span></> },
          { value: "past", label: <>Past and cancelled <span className="text-muted-foreground">{past.length}</span></> }
        ]} />
        <Card>
          {q.isLoading ? <Busy label="Loading your bookings"><ListSkeleton rows={2} /></Busy>
            : !list.length ? (
              <EmptyState icon={<CalendarDays />} title={tab === "upcoming" ? "No upcoming trials" : "No past trials"}>
                {tab === "upcoming" && <><p className="text-[13px] text-muted-foreground">Book a free class and it will show up here.</p><Button asChild size="sm" variant="brand"><Link to="/book">Book a trial</Link></Button></>}
              </EmptyState>
            ) : list.map(b => (
              <div key={b.reference} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <DateBox iso={b.startUtc} tz={b.parentTimezone} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2"><strong>{subjectLabel(b.subject)} trial · {b.child.name}</strong><StatusBadge b={b} /></div>
                  <span className="text-[13px] tabular-nums text-muted-foreground">{formatDayLong(new Date(b.startUtc), b.parentTimezone)} · {formatTime(b.startUtc, b.parentTimezone)} {zoneAbbreviation(b.parentTimezone, new Date(b.startUtc))}</span>
                  <span className="text-[13px] text-muted-foreground">with {b.mentor.name}</span>
                </div>
                <div className="col-span-2 flex gap-2 sm:col-span-1">
                  <Button asChild variant="outline" size="sm"><Link to={`/booking/${b.reference}`}>View</Link></Button>
                  {b.status === "CONFIRMED" && new Date(b.startUtc) > now && <Button variant="destructive-ghost" size="sm" onClick={() => setToCancel(b)}>Cancel</Button>}
                </div>
              </div>
            ))}
        </Card>
      </div>
      <ConfirmDialog open={!!toCancel} onOpenChange={o => !o && setToCancel(null)} title="Cancel this trial?" confirmLabel="Cancel trial" cancelLabel="Keep trial" busy={cancel.isPending}
        description={toCancel ? `${toCancel.child.name}'s class on ${formatSlot(toCancel.startUtc, toCancel.parentTimezone)} will be cancelled and the mentor will be told.` : ""}
        onConfirm={() => toCancel && cancel.mutate(toCancel.reference)} />
    </PublicLayout>
  );
}
