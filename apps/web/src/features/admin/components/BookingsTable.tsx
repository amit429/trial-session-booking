import { useQuery } from "@tanstack/react-query";
import { ZONE_NAMES, formatDay, formatTime, zoneAbbreviation, type AdminBookingDto } from "@shared";
import { Copy, ExternalLink, Info, MoreHorizontal, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "@/features/my-bookings/pages/MyBookingsPage";
import { OutboxList } from "@/components/booking/OutboxList";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { Sheet } from "@/components/ui/dialog";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/feedback/EmptyState";
import { api } from "@/lib/api-client";
import { cn, subjectLabel } from "@/lib/utils";
import { BookingFacts, BookingFactsSkeleton, copyLink, isUpcoming, useAdminCancel } from "../pages/BookingDetailPage";
import type { BookingDetail } from "../types";

export { AccountBadge } from "@/components/booking/AccountBadge";

const IST = "Asia/Kolkata";
const HEAD = ["Booking", "India time", "Parent's time", "Child", "Parent", "Mentor", "Status"];
const th = "[&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground";

/** Placeholder rows shaped like the real table. */
export function TableSkeleton({ rows = 6, cols = HEAD }: { rows?: number; cols?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card" aria-busy="true" aria-label="Loading">
      <table className="w-full text-[13.5px]">
        <thead><tr className={th}>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-border last:border-b-0">
              {cols.map((c, i) => <td key={c} className="px-3 py-3"><Skeleton className={cn("h-4", i === 0 ? "w-20" : "w-24")} />{i > 0 && i < 6 && <Skeleton className="mt-1.5 h-3 w-16" />}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bookings table with row actions, a quick-look sheet and admin cancel. Times: India first, parent's alongside. */
export function BookingsTable({ rows, fetching }: { rows: AdminBookingDto[]; fetching?: boolean }) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ["admin-booking", sheet], queryFn: () => api.get<BookingDetail>(`/admin/bookings/${sheet}`), enabled: !!sheet });
  const { ask, dialog } = useAdminCancel();

  if (!rows.length) return <Card><EmptyState icon={<Search />} title="No bookings match"><p className="text-[13px] text-muted-foreground">Try a different filter or search.</p></EmptyState></Card>;
  const b = detail.data;
  return (
    <>
      <div aria-busy={fetching} className={cn("overflow-x-auto rounded-xl border border-border bg-card transition-opacity", fetching && "opacity-60")}>
        <table className="w-full border-collapse text-[13.5px] tabular-nums">
          <thead><tr className={th}>{HEAD.map(h => <th key={h}>{h}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
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
                      <DropdownItem onSelect={() => setSheet(r.reference)}><Info />Quick look</DropdownItem>
                      <DropdownItem onSelect={() => navigate(`/admin/bookings/${r.reference}`)}><ExternalLink />Open booking</DropdownItem>
                      {r.status === "CONFIRMED" && <DropdownItem onSelect={() => copyLink(r.meetingUrl)}><Copy />Copy class link</DropdownItem>}
                      {isUpcoming(r) && <><DropdownSeparator /><DropdownItem destructive onSelect={() => ask(r)}><XCircle />Cancel booking</DropdownItem></>}
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
        title={b ? `${subjectLabel(b.subject)} trial · ${b.child.name}` : <Skeleton className="h-6 w-56" />}
        footer={b && <>
          <Button asChild variant="outline"><Link to={`/admin/bookings/${b.reference}`}><ExternalLink />Open booking</Link></Button>
          {isUpcoming(b) && <Button variant="destructive" onClick={() => ask(b)}>Cancel booking</Button>}
        </>}
      >
        {b ? (
          <>
            <div><StatusBadge b={b} /></div>
            <BookingFacts b={b} />
            <div className="flex flex-col gap-2"><strong className="text-sm">Messages sent</strong>{b.messages.length ? <OutboxList items={b.messages} /> : <p className="text-[13px] text-muted-foreground">No messages recorded for this booking.</p>}</div>
          </>
        ) : (
          <><Skeleton className="h-[22px] w-24" /><BookingFactsSkeleton /><Skeleton className="h-24" /></>
        )}
      </Sheet>
      {dialog}
    </>
  );
}
