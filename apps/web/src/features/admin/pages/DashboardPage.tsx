import { MENTOR_TIMEZONE, formatDayLong, zonedTime } from "@shared";
import { CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Busy, ChartSkeleton, StatsSkeleton } from "@/components/feedback/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard, useUpcomingBookings } from "../api/admin.api";
import { AdminPage, PageTitle } from "../components/AdminPage";
import { BookingsTable } from "../components/BookingsTable";
import { CapacityChart } from "../components/CapacityChart";
import { StatCard } from "../components/StatCard";
import { TableSkeleton } from "../components/TableSkeleton";

const BUSY_THRESHOLD = 70;

export function DashboardPage() {
  const dashboard = useDashboard();
  const next = useUpcomingBookings(6);
  const d = dashboard.data;
  const total = d?.capacity.reduce((a, c) => a + c.capacity, 0) ?? 0;
  const booked = d?.capacity.reduce((a, c) => a + c.booked, 0) ?? 0;
  const pct = total ? Math.round((booked / total) * 100) : 0;
  const busy = pct > BUSY_THRESHOLD;

  return (
    <AdminPage crumbs={[{ label: "Dashboard" }]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Dashboard">Dates are India dates: the 2-per-day limit counts on the mentor's calendar.</PageTitle>
        <Button asChild variant="outline" size="sm"><Link to="/admin/bookings"><CalendarDays />All bookings</Link></Button>
      </div>
      {!d ? (
        <Busy><div className="flex flex-col gap-5"><StatsSkeleton /><ChartSkeleton /></div></Busy>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard label="Trials today" value={d.todayCount} foot={formatDayLong(zonedTime(d.today, 720, MENTOR_TIMEZONE).toJSDate(), MENTOR_TIMEZONE)} badge={<Badge>India</Badge>} />
            <StatCard label="Next 7 days" value={d.next7DaysCount} foot="Confirmed, all mentors" />
            <StatCard label="Capacity used" value={`${pct}%`} foot={`${booked} of ${total} trials in 14 days`} badge={<Badge variant={busy ? "warning" : "success"}>{busy ? "Busy" : "Healthy"}</Badge>} />
            <StatCard
              label="Fully booked days"
              value={d.fullyBookedIstDates.length}
              foot={d.fullyBookedIstDates.length ? "Consider adding shifts" : "None in the next 14 days"}
              badge={d.fullyBookedIstDates.length ? <Badge variant="destructive">Action</Badge> : undefined}
            />
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1"><CardTitle>Trials per India date</CardTitle><CardDescription>Booked vs capacity (mentors working that day × 2)</CardDescription></div>
                <div className="flex gap-4 text-[12.5px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-brand" />Booked</span>
                  <span className="flex items-center gap-1.5"><i className="size-2 rounded-full border border-border bg-muted" />Capacity</span>
                  <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-destructive" />Full</span>
                </div>
              </div>
            </CardHeader>
            <CardContent><CapacityChart data={d.capacity} /></CardContent>
          </Card>
        </>
      )}
      <h2 className="text-base font-semibold">Up next</h2>
      {next.data ? <BookingsTable rows={next.data.items} /> : <TableSkeleton rows={4} />}
    </AdminPage>
  );
}
