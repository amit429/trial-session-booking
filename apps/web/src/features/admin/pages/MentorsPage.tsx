import { MENTOR_TIMEZONE, formatDayLong } from "@shared";
import { Link } from "react-router-dom";
import { Busy, CardGridSkeleton } from "@/components/feedback/skeletons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAdminMentors } from "../api/admin.api";
import { AdminPage, PageTitle } from "../components/AdminPage";
import { daysOff, shiftText } from "../components/shift";

export function MentorsPage() {
  const list = useAdminMentors();
  return (
    <AdminPage crumbs={[{ label: "Mentors" }]}>
      <PageTitle title="Mentors">
        Today in India: {formatDayLong(new Date(), MENTOR_TIMEZONE)}. Each mentor takes up to 2 trials per India date.
      </PageTitle>
      {!list.data ? (
        <Busy>
          <CardGridSkeleton count={9} />
        </Busy>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
          {list.data.map(m => (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} />
                  <div className="flex min-w-0 flex-col">
                    <Link to={`/admin/mentors/${m.id}`} className="font-semibold hover:underline">
                      {m.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {m.shiftLabel} · {shiftText(m.weeklyShift)} IST
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Today</span>
                    {m.onShiftToday ? (
                      <span className="font-medium tabular-nums">
                        {m.todayBooked} / {m.maxDailyTrials}
                        {m.todayBooked >= m.maxDailyTrials && (
                          <Badge variant="destructive" className="ml-1.5">
                            Full
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <Badge variant="secondary">Day off</Badge>
                    )}
                  </div>
                  <Progress value={m.onShiftToday ? m.todayBooked : 0} max={m.maxDailyTrials} label={`${m.name}: trials today`} />
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">
                    {m.upcomingCount} upcoming · off {daysOff(m.weeklyShift) || "none"}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/mentors/${m.id}`}>Schedule</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
