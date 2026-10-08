import { MENTOR_TIMEZONE, formatSlot, formatZoneLabel, subjectLabel, type AdminBookingDto } from "@shared";
import { Link } from "react-router-dom";
import { AccountBadge } from "@/components/booking";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/card";

/** Definition list shared by the quick-look sheet and the full booking page. India time first. */
export function BookingFacts({ booking: b }: { booking: AdminBookingDto }) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-3.5 text-sm [&_dt]:font-medium">
      <dt>India time</dt>
      <dd className="tabular-nums">{formatSlot(b.startUtc, MENTOR_TIMEZONE)}<div className="text-[13px] text-muted-foreground">India date {b.mentorLocalDate} counts toward the mentor's 2-a-day limit</div></dd>
      <dt>Parent's time</dt>
      <dd className="tabular-nums">{formatSlot(b.startUtc, b.parentTimezone)}<div className="text-[13px] text-muted-foreground">{formatZoneLabel(b.parentTimezone, b.startUtc)}</div></dd>
      <dt>Child</dt>
      <dd>{b.child.name} · Grade {b.child.grade} · {subjectLabel(b.subject)}</dd>
      <dt>Parent</dt>
      <dd>{b.parent.name}<div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{b.parent.email} <AccountBadge status={b.parentStatus} /></div></dd>
      <dt>Mentor</dt>
      <dd><Link className="flex items-center gap-2 font-medium hover:underline" to={`/admin/mentors/${b.mentor.id}`}><Avatar name={b.mentor.name} size="sm" />{b.mentor.name}</Link><div className="text-[13px] text-muted-foreground">{b.mentor.shiftLabel}</div></dd>
      <dt>Class link</dt>
      <dd className="truncate font-mono text-xs">{b.meetingUrl}</dd>
      <dt>Booked</dt>
      <dd className="text-muted-foreground">{formatSlot(b.createdAt, MENTOR_TIMEZONE)}</dd>
      {b.cancelledAt && (
        <>
          <dt>Cancelled</dt>
          <dd className="text-muted-foreground">{formatSlot(b.cancelledAt, MENTOR_TIMEZONE)} by {b.cancelledBy === "ADMIN" ? "our team" : "the parent"}</dd>
        </>
      )}
    </dl>
  );
}

export function BookingFactsSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4"><Skeleton className="h-4" /><Skeleton className="h-4 w-3/4" /></div>
      ))}
    </div>
  );
}
