import { MENTOR_TIMEZONE, WEEKDAY_SHORT, formatDay, formatHhmm, formatSlot, formatTime, zonedTime } from "@shared";
import { Link, useParams } from "react-router-dom";
import { Busy } from "@/components/feedback/skeletons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useMentorSchedule } from "../api/admin.api";
import { AdminPage } from "../components/AdminPage";
import { ALL_WEEKDAYS } from "../components/shift";

function ScheduleSkeleton() {
  return (
    <Busy>
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex items-center gap-3.5">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-7 gap-2">
              {ALL_WEEKDAYS.map(i => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
                <Skeleton className="h-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Busy>
  );
}

export function MentorDetailPage() {
  const { id = "" } = useParams();
  const query = useMentorSchedule(id);
  const s = query.data;

  return (
    <AdminPage crumbs={[{ label: "Mentors", to: "/admin/mentors" }, { label: s?.mentor.name ?? "Mentor" }]}>
      {!s ? (
        <ScheduleSkeleton />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3.5">
              <Avatar name={s.mentor.name} size="lg" />
              <div className="flex min-w-0 flex-col">
                <h1 className="text-xl font-semibold">{s.mentor.name}</h1>
                <span className="text-[13px] text-muted-foreground">{s.mentor.bio}</span>
              </div>
              <Badge variant="brand" className="ml-auto">
                {s.mentor.shiftLabel}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Weekly shift</CardTitle>
              <CardDescription>India Standard Time (UTC+05:30)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {ALL_WEEKDAYS.map(d => {
                  const block = s.weeklyShift.find(x => x.weekday === d);
                  return (
                    <div
                      key={d}
                      className={cn(
                        "rounded-lg border border-border px-1.5 py-2.5 text-center text-xs",
                        block && "border-transparent bg-brand-soft text-brand-text"
                      )}
                    >
                      <b className="mb-0.5 block text-[12.5px] text-foreground">{WEEKDAY_SHORT[d]}</b>
                      {block ? `${formatHhmm(block.start)}–${formatHhmm(block.end)}` : "Off"}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Next 14 India dates</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {s.days.map(d => (
                <div
                  key={d.istDate}
                  className="grid grid-cols-1 gap-4 border-b border-border py-3.5 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)]"
                >
                  <div className="flex flex-col gap-1.5">
                    <strong>{formatDay(zonedTime(d.istDate, 720, MENTOR_TIMEZONE).toJSDate(), MENTOR_TIMEZONE)}</strong>
                    {d.onShift ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {d.booked} / {d.max} trials
                        </span>
                        <Progress value={d.booked} max={d.max} label={`Trials on ${d.istDate}`} />
                      </>
                    ) : (
                      <Badge variant="secondary" className="self-start">
                        Day off
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {d.bookings.length ? (
                      d.bookings.map(b => (
                        <div
                          key={b.reference}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span>
                              <strong className="tabular-nums">{formatTime(b.startUtc, MENTOR_TIMEZONE)}</strong> · {b.child.name}{" "}
                              <span className="text-muted-foreground">(Grade {b.child.grade})</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Parent's time {formatSlot(b.startUtc, b.parentTimezone)} · {b.parent.name}
                            </span>
                          </div>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/admin/bookings/${b.reference}`}>Open</Link>
                          </Button>
                        </div>
                      ))
                    ) : d.onShift ? (
                      <span className="pt-0.5 text-[13px] text-muted-foreground">No trials booked</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
