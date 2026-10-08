import { MENTOR_TIMEZONE, ZONE_NAMES, formatDay, formatTime, subjectLabel, zoneAbbreviation, type AdminBookingDto } from "@shared";
import { Copy, ExternalLink, Info, MoreHorizontal, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { OutboxList, StatusBadge } from "@/components/booking";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { Sheet } from "@/components/ui/dialog";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { useAdminBooking } from "../api/admin.api";
import { useCancelBookingDialog } from "../hooks/useCancelBookingDialog";
import { BookingFacts, BookingFactsSkeleton } from "./BookingFacts";
import { isUpcoming } from "./booking-state";
import { BOOKING_COLUMNS, tableHeadClass } from "./table";

/** Bookings table with row actions, a quick-look sheet and admin cancel. Times: India first, parent's alongside. */
export function BookingsTable({ rows, fetching }: { rows: AdminBookingDto[]; fetching?: boolean }) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<string | null>(null);
  const detail = useAdminBooking(sheet);
  const { ask, dialog } = useCancelBookingDialog();

  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon={<Search />} title="No bookings match">
          <p className="text-[13px] text-muted-foreground">Try a different filter or search.</p>
        </EmptyState>
      </Card>
    );
  }
  const b = detail.data;
  return (
    <>
      <div
        aria-busy={fetching}
        className={cn("overflow-x-auto rounded-xl border border-border bg-card transition-opacity", fetching && "opacity-60")}
      >
        <table className="w-full border-collapse text-[13.5px] tabular-nums">
          <thead>
            <tr className={tableHeadClass}>
              {BOOKING_COLUMNS.map(h => (
                <th key={h}>{h}</th>
              ))}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.reference}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle"
              >
                <td>
                  <button className="cursor-pointer font-mono font-medium hover:underline" onClick={() => setSheet(r.reference)}>
                    {r.reference}
                  </button>
                </td>
                <td>
                  <div className="font-medium">{formatDay(r.startUtc, MENTOR_TIMEZONE)}</div>
                  <div className="text-[12.5px] text-muted-foreground">{formatTime(r.startUtc, MENTOR_TIMEZONE)}</div>
                </td>
                <td>
                  <div>
                    {formatTime(r.startUtc, r.parentTimezone)} {zoneAbbreviation(r.parentTimezone, r.startUtc)}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">{ZONE_NAMES[r.parentTimezone] ?? r.parentTimezone}</div>
                </td>
                <td>
                  <div>{r.child.name}</div>
                  <div className="text-[12.5px] text-muted-foreground">
                    Grade {r.child.grade} · {subjectLabel(r.subject)}
                  </div>
                </td>
                <td>
                  <div className="font-medium">{r.parent.name}</div>
                  <div className="text-[12.5px] text-muted-foreground">{r.parent.email}</div>
                </td>
                <td>
                  <Link to={`/admin/mentors/${r.mentor.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Avatar name={r.mentor.name} size="sm" />
                    {r.mentor.name}
                  </Link>
                </td>
                <td>
                  <StatusBadge booking={r} />
                </td>
                <td className="w-11">
                  <DropdownMenu>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.reference}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => setSheet(r.reference)}>
                        <Info />
                        Quick look
                      </DropdownItem>
                      <DropdownItem onSelect={() => navigate(`/admin/bookings/${r.reference}`)}>
                        <ExternalLink />
                        Open booking
                      </DropdownItem>
                      {r.status === "CONFIRMED" && (
                        <DropdownItem onSelect={() => copyToClipboard(r.meetingUrl, "Class link")}>
                          <Copy />
                          Copy class link
                        </DropdownItem>
                      )}
                      {isUpcoming(r) && (
                        <>
                          <DropdownSeparator />
                          <DropdownItem destructive onSelect={() => ask(r)}>
                            <XCircle />
                            Cancel booking
                          </DropdownItem>
                        </>
                      )}
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
        footer={
          b && (
            <>
              <Button asChild variant="outline">
                <Link to={`/admin/bookings/${b.reference}`}>
                  <ExternalLink />
                  Open booking
                </Link>
              </Button>
              {isUpcoming(b) && (
                <Button variant="destructive" onClick={() => ask(b)}>
                  Cancel booking
                </Button>
              )}
            </>
          )
        }
      >
        {b ? (
          <>
            <div>
              <StatusBadge booking={b} />
            </div>
            <BookingFacts booking={b} />
            <div className="flex flex-col gap-2">
              <strong className="text-sm">Messages sent</strong>
              {b.messages.length ? (
                <OutboxList items={b.messages} />
              ) : (
                <p className="text-[13px] text-muted-foreground">No messages recorded for this booking.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-[22px] w-24" />
            <BookingFactsSkeleton />
            <Skeleton className="h-24" />
          </>
        )}
      </Sheet>
      {dialog}
    </>
  );
}
