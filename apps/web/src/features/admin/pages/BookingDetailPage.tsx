import { MENTOR_TIMEZONE, formatSlot, subjectLabel } from "@shared";
import { Copy, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { OutboxList, StatusBadge } from "@/components/booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import { useAdminBooking } from "../api/admin.api";
import { AdminPage } from "../components/AdminPage";
import { BookingFacts, BookingFactsSkeleton } from "../components/BookingFacts";
import { isUpcoming } from "../components/booking-state";
import { useCancelBookingDialog } from "../hooks/useCancelBookingDialog";

/** Full-page admin view of one booking: /admin/bookings/:reference. */
export function BookingDetailPage() {
  const { reference = "" } = useParams();
  const query = useAdminBooking(reference);
  const { ask, dialog } = useCancelBookingDialog();
  const b = query.data;

  return (
    <AdminPage crumbs={[{ label: "Bookings", to: "/admin/bookings" }, { label: reference }]}>
      {query.isError ? (
        <Alert variant="destructive" title="We couldn't find this booking">
          Check the reference, or go back to <Link className="underline" to="/admin/bookings">all bookings</Link>.
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              {b ? (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{b.reference}</span>
                  <h1 className="text-xl font-semibold">{subjectLabel(b.subject)} trial · {b.child.name}</h1>
                  <div className="flex items-center gap-2"><StatusBadge booking={b} /><span className="text-[13px] text-muted-foreground">{formatSlot(b.startUtc, MENTOR_TIMEZONE)}</span></div>
                </div>
              ) : (
                <div className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-64" /><Skeleton className="h-5 w-48" /></div>
              )}
              {b && (
                <div className="flex flex-wrap gap-2">
                  {b.status === "CONFIRMED" && <Button variant="outline" onClick={() => copyToClipboard(b.meetingUrl, "Class link")}><Copy />Copy class link</Button>}
                  {isUpcoming(b) && <Button variant="destructive" onClick={() => ask(b)}><XCircle />Cancel booking</Button>}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Details</CardTitle><CardDescription>India time first, the parent's alongside</CardDescription></CardHeader>
              <CardContent>{b ? <BookingFacts booking={b} /> : <BookingFactsSkeleton />}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Messages sent</CardTitle><CardDescription>What the parent and mentor received</CardDescription></CardHeader>
              <CardContent>
                {b ? (
                  b.messages.length ? <OutboxList items={b.messages} /> : <p className="text-[13px] text-muted-foreground">No messages recorded for this booking (seeded data).</p>
                ) : (
                  <div className="flex flex-col gap-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {dialog}
    </AdminPage>
  );
}
