import { ZONE_NAMES, formatDayLong, formatSlot, formatTime, formatZoneLabel, normalizeZone, subjectLabel, zoneAbbreviation } from "@shared";
import { CalendarDays, Check, CheckCircle2, Download, Globe, Link2, Mail, Search, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CopyField } from "@/components/booking";
import { PublicLayout } from "@/components/layout";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Separator } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/session";
import { useBooking, useCancelBooking } from "../api/booking.api";
import { BookingSkeleton } from "../components/BookingSkeleton";

/** Confirmation and private manage page (FR-8, FR-10). */
export function BookingPage() {
  const { reference = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") ?? undefined;
  const { parent, admin, isLoading: authLoading } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Staff without a parent's link get the admin view of the booking instead.
  const sendToAdmin = !authLoading && !!admin && !token && !parent;

  const q = useBooking(reference, token, !authLoading && !sendToAdmin);
  const cancel = useCancelBooking(reference, token);
  const confirmCancel = () =>
    cancel.mutate(undefined, {
      onSuccess: () => toast.success("Trial cancelled", { description: "The mentor has been told and the time is free again." }),
      onError: e => toast.error(errorMessage(e)),
      onSettled: () => setConfirmOpen(false)
    });

  if (sendToAdmin) return <Navigate to={`/admin/bookings/${reference}`} replace />;
  if (authLoading || q.isLoading) return <PublicLayout narrow><BookingSkeleton /></PublicLayout>;
  if (q.isError || !q.data) {
    return (
      <PublicLayout narrow>
        <Card className="mx-auto max-w-[400px]">
          <CardContent className="flex flex-col items-center gap-3 p-7 text-center">
            <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><Search className="size-5" /></div>
            <h1 className="text-xl font-semibold">We couldn't find this booking</h1>
            <p className="text-muted-foreground">The link may be incomplete. Use the link from your confirmation email, or sign in to see your bookings.</p>
            <div className="flex gap-2"><Button asChild><Link to="/login">Sign in</Link></Button><Button asChild variant="outline"><Link to="/book">Book a trial</Link></Button></div>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  const b = q.data;
  const tz = b.parentTimezone;
  const browser = (() => { try { return normalizeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return null; } })();
  const cancelled = b.status === "CANCELLED";
  const done = !cancelled && new Date(b.startUtc) <= new Date();
  // The parent's own link, opened by someone who isn't signed in as anyone.
  const isGuestView = !!token && !parent && !admin;
  const hero = cancelled
    ? { Icon: XCircle, bg: "bg-destructive-soft text-destructive-text", title: "This trial was cancelled", text: b.cancelledBy === "ADMIN" ? "Our team cancelled this class. The time is free for other families." : "The time is free for other families." }
    : done
      ? { Icon: CheckCircle2, bg: "bg-muted text-muted-foreground", title: "This trial has taken place", text: "We hope your child enjoyed it." }
      : { Icon: Check, bg: "bg-success-soft text-success-text", title: "Your trial is booked", text: `We've emailed the details to ${b.parent.email}.` };
  const icsUrl = `/api/bookings/${b.reference}/calendar.ics${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  return (
    <PublicLayout narrow>
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        {admin && token && (
          <Alert variant="info" icon={<ShieldCheck />} title="You're signed in as admin">
            This is the parent's view of the booking. <Link className="font-medium text-foreground underline underline-offset-4" to={`/admin/bookings/${b.reference}`}>Open it in admin</Link>
          </Alert>
        )}
        <Card className="shadow-md">
          <CardContent className="flex flex-col gap-6 p-7">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className={`grid size-[52px] place-items-center rounded-full ${hero.bg}`}><hero.Icon className="size-6" /></div>
              <h1 className="mt-1.5 text-[22px] font-semibold">{hero.title}</h1>
              <p className="text-muted-foreground">{hero.text}</p>
            </div>
            {browser && browser !== tz && !cancelled && (
              <Alert variant="info" icon={<Globe />} title={`You're in ${ZONE_NAMES[browser] ?? browser} right now`}>That's {formatSlot(b.startUtc, browser)} for you.</Alert>
            )}
            <Separator />
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-y-[18px] [&_dd]:mb-3 sm:[&_dd]:mb-0 [&_dt]:font-medium">
              <dt>What</dt>
              <dd>{subjectLabel(b.subject)} trial for {b.child.name} <span className="text-muted-foreground">· Grade {b.child.grade}</span></dd>
              <dt>When</dt>
              <dd>
                <div className="font-semibold">{formatDayLong(new Date(b.startUtc), tz)}</div>
                <div className="tabular-nums">{formatTime(b.startUtc, tz)} – {formatTime(b.endUtc, tz)} {zoneAbbreviation(tz, new Date(b.startUtc))} <span className="text-muted-foreground">· {formatZoneLabel(tz, new Date(b.startUtc))}</span></div>
                <div className="text-[13px] text-muted-foreground">Mentor's time: {formatSlot(b.startUtc, b.mentorTimezone)}</div>
              </dd>
              <dt>Mentor</dt>
              <dd className="flex items-start gap-2">
                <Avatar name={b.mentor.name} />
                <div className="flex flex-col gap-0.5"><span className="font-semibold">{b.mentor.name} <Badge className="ml-1">{b.mentor.shiftLabel}</Badge></span><span className="text-[13px] text-muted-foreground">{b.mentor.bio}</span></div>
              </dd>
              <dt>Parent</dt>
              <dd>{b.parent.name} <span className="text-muted-foreground">· {b.parent.email}</span></dd>
              {!cancelled && <><dt>Where</dt><dd><CopyField value={b.meetingUrl} label="Class link" /></dd></>}
              <dt>Reference</dt>
              <dd className="font-mono">{b.reference}</dd>
            </dl>
            <Separator />
            {cancelled ? (
              <Button asChild variant="brand" className="self-start"><Link to="/book">Book another time</Link></Button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline"><a href={b.googleCalendarUrl} target="_blank" rel="noreferrer"><CalendarDays />Google Calendar</a></Button>
                  <Button asChild variant="outline"><a href={icsUrl}><Download />Apple / Outlook (.ics)</a></Button>
                </div>
                {!done && <Button variant="destructive-ghost" onClick={() => setConfirmOpen(true)}>Cancel trial</Button>}
              </div>
            )}
          </CardContent>
        </Card>

        {b.manageUrl && token && !admin && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-[18px]">
              <p className="flex items-center gap-2 font-semibold"><Link2 className="size-4" />Manage this booking</p>
              <p className="text-[13px] text-muted-foreground">This private link lets you view or cancel without an account. Keep it to yourself; we've also emailed it to you.</p>
              <CopyField value={b.manageUrl} display={`…/booking/${b.reference}?token=${token.slice(0, 10)}…`} label="Manage link" />
            </CardContent>
          </Card>
        )}

        {isGuestView && !cancelled && b.parentAccount === "PENDING" && (
          <Alert variant="info" icon={<Mail />} title="Finish creating your account">Check {b.parent.email} for the verification link. Once verified, sign in to see all your bookings.</Alert>
        )}

        {isGuestView && !cancelled && b.parentAccount === "GUEST" && (
          <Card className="border-transparent bg-brand-soft">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-[18px]">
              <div className="flex flex-col gap-0.5"><strong>See all your bookings in one place</strong><span className="text-[13px] text-muted-foreground">Create an account with {b.parent.email}.</span></div>
              <Button asChild><Link to={`/signup?email=${encodeURIComponent(b.parent.email)}`}>Create account</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel this trial?"
        description={`${b.child.name}'s class on ${formatSlot(b.startUtc, tz)} will be cancelled. We'll let the mentor know, and the time becomes free for other families.`}
        confirmLabel="Cancel trial"
        cancelLabel="Keep trial"
        busy={cancel.isPending}
        onConfirm={confirmCancel}
      />
    </PublicLayout>
  );
}
