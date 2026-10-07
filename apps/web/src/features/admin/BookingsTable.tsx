import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZONE_NAMES, formatDay, formatSlot, formatTime, formatZoneLabel, zoneAbbreviation, type AdminBookingDto } from "@trial/shared";
import { Copy, ExternalLink, Info, MoreHorizontal, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/features/account/MyBookingsPage";
import { OutboxList } from "@/features/dev/OutboxList";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty";
import { ApiError, api } from "@/lib/api";
import { subjectLabel } from "@/lib/utils";
import type { BookingDetail } from "./types";

const IST = "Asia/Kolkata";
const isUpcoming = (b: AdminBookingDto) => b.status === "CONFIRMED" && new Date(b.startUtc) > new Date();
const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast.success("Class link copied"));

export function AccountBadge({ status }: { status: string }) {
  if (status === "VERIFIED") return <Badge variant="success" dot>Verified</Badge>;
  if (status === "PENDING") return <Badge variant="warning" dot>Pending</Badge>;
  return <Badge>Guest</Badge>;
}

/** Bookings table with row actions, a detail sheet and admin cancel. Times: India first, parent's alongside. */
export function BookingsTable({ rows }: { rows: AdminBookingDto[] }) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<AdminBookingDto | null>(null);
  const detail = useQuery({ queryKey: ["admin-booking", sheet], queryFn: () => api.get<BookingDetail>(`/admin/bookings/${sheet}`), enabled: !!sheet });
  const cancel = useMutation({
    mutationFn: (ref: string) => api.post(`/admin/bookings/${ref}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("admin") }); setToCancel(null); toast.success("Booking cancelled", { description: "The parent and mentor have been told." }); },
    onError: e => { setToCancel(null); toast.error(e instanceof ApiError ? e.message : "Something went wrong."); }
  });

  if (!rows.length) return <Card><EmptyState icon={<Search />} title="No bookings match"><p className="text-[13px] text-muted-foreground">Try a different filter or search.</p></EmptyState></Card>;
  const b = detail.data;
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-[13.5px] tabular-nums">
          <thead>
            <tr className="[&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground">
              <th>Booking</th><th>India time</th><th>Parent's time</th><th>Child</th><th>Parent</th><th>Mentor</th><th>Status</th><th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.reference} className="border-b border-border last:border-b-0 hover:bg-muted/50 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle">
                <td><button className="cursor-pointer font-mono font-medium hover:underline" onClick={() => setSheet(r.reference)}>{r.reference}</button></td>
                <td><div className="font-medium">{formatDay(r.startUtc, IST)}</div><div className="text-[12.5px] text-muted-foreground">{formatTime(r.startUtc, IST)}</div></td>
                <td><div>{formatTime(r.startUtc, r.parentTimezone)} {zoneAbbreviation(r.parentTimezone, r.startUtc)}</div><div className="text-[12.5px] text-muted-foreground">{ZONE_NAMES[r.parentTimezone] ?? r.parentTimezone}</div></td>
                <td><div>{r.child.name}</div><div className="text-[12.5px] text-muted-foreground">Grade {r.child.grade} · {subjectLabel(r.subject)}</div></td>
                <td><div className="font-medium">{r.parent.name}</div><div className="text-[12.5px] text-muted-foreground">{r.parent.email}</div></td>
                <td><Link to={`/admin/mentors/${r.mentor.id}`} className="flex items-center gap-2 font-medium hover:underline"><Avatar name={r.mentor.name} size="sm" />{r.mentor.name}</Link></td>
                <td><StatusBadge b={r} /></td>
                <td className="w-11">
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.reference}`}><MoreHorizontal /></Button></DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => setSheet(r.reference)}><Info />View details</DropdownItem>
                      <DropdownItem onSelect={() => window.open(`/booking/${r.reference}`, "_self")}><ExternalLink />Open booking page</DropdownItem>
                      <DropdownItem onSelect={() => copy(r.meetingUrl)}><Copy />Copy class link</DropdownItem>
                      {isUpcoming(r) && <><DropdownSeparator /><DropdownItem destructive onSelect={() => setToCancel(r)}><XCircle />Cancel booking</DropdownItem></>}
                    </DropdownContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!sheet}
        onOpenChange={o => !o && setSheet(null)}
        subtitle={<span className="font-mono text-xs text-muted-foreground">{sheet}</span>}
        title={b ? `${subjectLabel(b.subject)} trial · ${b.child.name}` : "Loading…"}
        footer={b && <>
          <Button asChild variant="outline"><Link to={`/booking/${b.reference}`}><ExternalLink />Booking page</Link></Button>
          {isUpcoming(b) && <Button variant="destructive" onClick={() => setToCancel(b)}>Cancel booking</Button>}
        </>}
      >
        {b && (
          <>
            <div><StatusBadge b={b} /></div>
            <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-4 gap-y-3.5 text-sm [&_dt]:font-medium">
              <dt>India time</dt><dd className="tabular-nums">{formatSlot(b.startUtc, IST)}</dd>
              <dt>Parent's time</dt><dd className="tabular-nums">{formatSlot(b.startUtc, b.parentTimezone)}<div className="text-[13px] text-muted-foreground">{formatZoneLabel(b.parentTimezone, b.startUtc)}</div></dd>
              <dt>Child</dt><dd>{b.child.name} · Grade {b.child.grade}</dd>
              <dt>Parent</dt><dd>{b.parent.name}<div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{b.parent.email} <AccountBadge status={b.parentStatus} /></div></dd>
              <dt>Mentor</dt><dd><Link className="font-medium underline underline-offset-4" to={`/admin/mentors/${b.mentor.id}`}>{b.mentor.name}</Link><div className="text-[13px] text-muted-foreground">{b.mentor.shiftLabel} · India date {b.mentorLocalDate}</div></dd>
              <dt>Class link</dt><dd className="truncate font-mono text-xs">{b.meetingUrl}</dd>
            </dl>
            <div className="flex flex-col gap-2"><strong className="text-sm">Messages sent</strong>{b.messages.length ? <OutboxList items={b.messages} /> : <p className="text-[13px] text-muted-foreground">No messages recorded for this booking.</p>}</div>
          </>
        )}
      </Sheet>

      <ConfirmDialog open={!!toCancel} onOpenChange={o => !o && setToCancel(null)} title="Cancel this booking?" confirmLabel="Cancel booking" cancelLabel="Keep booking" busy={cancel.isPending}
        description={toCancel ? `${toCancel.child.name}'s class on ${formatSlot(toCancel.startUtc, IST)} will be cancelled. We'll tell the parent and the mentor, and the time becomes free again.` : ""}
        onConfirm={() => toCancel && cancel.mutate(toCancel.reference)} />
    </>
  );
}
