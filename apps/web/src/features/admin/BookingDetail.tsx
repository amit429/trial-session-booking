import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatSlot, formatZoneLabel, type AdminBookingDto } from "@trial/shared";
import { Copy, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/features/account/MyBookingsPage";
import { OutboxList } from "@/features/dev/OutboxList";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { subjectLabel } from "@/lib/utils";
import { AdminPage } from "./AdminLayout";
import { AccountBadge } from "./accountBadge";
import type { BookingDetail } from "./types";

const IST = "Asia/Kolkata";
export const isUpcoming = (b: Pick<AdminBookingDto, "status" | "startUtc">) => b.status === "CONFIRMED" && new Date(b.startUtc) > new Date();
export const copyLink = (v: string) => navigator.clipboard?.writeText(v).then(() => toast.success("Class link copied"), () => toast.error("Couldn't copy the link"));

/** Admin cancel with confirmation; refreshes every admin view. */
export function useAdminCancel() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<AdminBookingDto | null>(null);
  const m = useMutation({
    mutationFn: (ref: string) => api.post(`/admin/bookings/${ref}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("admin") || q.queryKey[0] === "slots" });
      setTarget(null);
      toast.success("Booking cancelled", { description: "The parent and mentor have been told." });
    },
    onError: e => { setTarget(null); toast.error(e instanceof ApiError ? e.message : "Something went wrong."); }
  });
  const dialog = (
    <ConfirmDialog open={!!target} onOpenChange={o => !o && setTarget(null)} title="Cancel this booking?" confirmLabel="Cancel booking" cancelLabel="Keep booking" busy={m.isPending}
      description={target ? `${target.child.name}'s class on ${formatSlot(target.startUtc, IST)} will be cancelled. We'll tell the parent and the mentor, and the time becomes free again.` : ""}
      onConfirm={() => target && m.mutate(target.reference)} />
  );
  return { ask: setTarget, dialog };
}

/** Definition list shared by the side sheet and the full admin page. */
export function BookingFacts({ b }: { b: AdminBookingDto }) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-3.5 text-sm [&_dt]:font-medium">
      <dt>India time</dt><dd className="tabular-nums">{formatSlot(b.startUtc, IST)}<div className="text-[13px] text-muted-foreground">India date {b.mentorLocalDate} counts toward the mentor's 2-a-day limit</div></dd>
      <dt>Parent's time</dt><dd className="tabular-nums">{formatSlot(b.startUtc, b.parentTimezone)}<div className="text-[13px] text-muted-foreground">{formatZoneLabel(b.parentTimezone, b.startUtc)}</div></dd>
      <dt>Child</dt><dd>{b.child.name} · Grade {b.child.grade} · {subjectLabel(b.subject)}</dd>
      <dt>Parent</dt><dd>{b.parent.name}<div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{b.parent.email} <AccountBadge status={b.parentStatus} /></div></dd>
      <dt>Mentor</dt><dd><Link className="flex items-center gap-2 font-medium hover:underline" to={`/admin/mentors/${b.mentor.id}`}><Avatar name={b.mentor.name} size="sm" />{b.mentor.name}</Link><div className="text-[13px] text-muted-foreground">{b.mentor.shiftLabel}</div></dd>
      <dt>Class link</dt><dd className="truncate font-mono text-xs">{b.meetingUrl}</dd>
      <dt>Booked</dt><dd className="text-muted-foreground">{formatSlot(b.createdAt, IST)}</dd>
      {b.cancelledAt && <><dt>Cancelled</dt><dd className="text-muted-foreground">{formatSlot(b.cancelledAt, IST)} by {b.cancelledBy === "ADMIN" ? "our team" : "the parent"}</dd></>}
    </dl>
  );
}

export function BookingFactsSkeleton() {
  return <div className="flex flex-col gap-3.5">{Array.from({ length: 7 }, (_, i) => <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4"><Skeleton className="h-4" /><Skeleton className="h-4 w-3/4" /></div>)}</div>;
}

/** Full-page admin view of one booking: /admin/bookings/:reference (admin session required). */
export function AdminBookingPage() {
  const { reference = "" } = useParams();
  const q = useQuery({ queryKey: ["admin-booking", reference], queryFn: () => api.get<BookingDetail>(`/admin/bookings/${reference}`), retry: false });
  const { ask, dialog } = useAdminCancel();
  const b = q.data;
  return (
    <AdminPage crumbs={[{ label: "Bookings", to: "/admin/bookings" }, { label: reference }]}>
      {q.isError ? (
        <Alert variant="destructive" title="We couldn't find this booking">Check the reference, or go back to <Link className="underline" to="/admin/bookings">all bookings</Link>.</Alert>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              {b ? (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{b.reference}</span>
                  <h1 className="text-xl font-semibold">{subjectLabel(b.subject)} trial · {b.child.name}</h1>
                  <div className="flex items-center gap-2"><StatusBadge b={b} /><span className="text-[13px] text-muted-foreground">{formatSlot(b.startUtc, IST)}</span></div>
                </div>
              ) : <div className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-64" /><Skeleton className="h-5 w-48" /></div>}
              {b && (
                <div className="flex flex-wrap gap-2">
                  {b.status === "CONFIRMED" && <Button variant="outline" onClick={() => copyLink(b.meetingUrl)}><Copy />Copy class link</Button>}
                  {isUpcoming(b) && <Button variant="destructive" onClick={() => ask(b)}><XCircle />Cancel booking</Button>}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card><CardHeader><CardTitle>Details</CardTitle><CardDescription>India time first, the parent's alongside</CardDescription></CardHeader><CardContent>{b ? <BookingFacts b={b} /> : <BookingFactsSkeleton />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Messages sent</CardTitle><CardDescription>What the parent and mentor received</CardDescription></CardHeader>
              <CardContent>{b ? (b.messages.length ? <OutboxList items={b.messages} /> : <p className="text-[13px] text-muted-foreground">No messages recorded for this booking (seeded data).</p>) : <div className="flex flex-col gap-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>}</CardContent>
            </Card>
          </div>
        </>
      )}
      {dialog}
    </AdminPage>
  );
}
