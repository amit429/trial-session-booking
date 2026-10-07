import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDay, formatDayLong, formatSlot, formatTime, formatZoneLabel, zonedTime, type AdminBookingDto, type OutboxDto } from "@trial/shared";
import { CalendarDays, Lock, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "@/components/SiteHeader";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { OutboxList } from "@/features/dev/OutboxList";
import { ApiError, api } from "@/lib/api";
import { setSession } from "@/lib/auth";
import type { AdminDto } from "@trial/shared";
import { cn } from "@/lib/utils";
import { AdminPage, PageTitle } from "./AdminLayout";
import { AccountBadge, BookingsTable } from "./BookingsTable";
import { CapacityChart } from "./CapacityChart";
import { WEEKDAYS, to12, type Dashboard, type MentorRow, type MentorSchedule, type Paged, type ParentDetail, type ParentRow } from "./types";

const IST = "Asia/Kolkata";
const Loading = () => <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState("admin@trialdesk.example");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api.post<{ admin: AdminDto }>("/auth/admin/login", { email: email.trim(), password }),
    onSuccess: r => { setSession(qc, { admin: r.admin }); toast.success("Signed in", { description: "Welcome to the admin console" }); const n = params.get("next"); navigate(n?.startsWith("/admin") ? n : "/admin"); }
  });
  const err = m.error instanceof ApiError ? m.error : null;
  return (
    <PublicLayout narrow>
      <Card className="mx-auto mt-6 max-w-[400px]">
        <CardContent className="flex flex-col gap-[18px] p-7">
          <div className="flex flex-col gap-2"><Badge className="self-start"><Lock />Staff only</Badge><h1 className="text-2xl font-semibold">Admin sign in</h1><p className="text-muted-foreground">Manage trials, parents and mentor schedules.</p></div>
          <form className="flex flex-col gap-4" noValidate onSubmit={e => { e.preventDefault(); m.mutate(); }}>
            {err && <Alert variant="destructive" icon={err.code === "RATE_LIMITED" ? <Lock /> : <XCircle />} title={err.code === "RATE_LIMITED" ? "Too many attempts" : "Email or password is incorrect"}>{err.code === "RATE_LIMITED" ? "Try again in a minute." : "Check both and try again."}</Alert>}
            <Field id="al-email" label="Email"><Input id="al-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field id="al-pw" label="Password"><Input id="al-pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
            <Button type="submit" className="w-full" disabled={m.isPending}>{m.isPending ? "Signing in…" : "Sign in"}</Button>
          </form>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}

function Stat({ label, value, foot, badge }: { label: string; value: React.ReactNode; foot: string; badge?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-muted-foreground">{label}</span>{badge}</div>
      <div className="text-[28px] font-semibold tabular-nums tracking-tight">{value}</div>
      <span className="text-xs text-muted-foreground">{foot}</span>
    </Card>
  );
}

export function DashboardPage() {
  const d = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api.get<Dashboard>("/admin/dashboard", { days: 14 }) });
  const next = useQuery({ queryKey: ["admin-bookings", "next"], queryFn: () => api.get<Paged<AdminBookingDto>>("/admin/bookings", { scope: "upcoming", status: "CONFIRMED", pageSize: 6 }) });
  const total = d.data?.capacity.reduce((a, c) => a + c.capacity, 0) ?? 0;
  const booked = d.data?.capacity.reduce((a, c) => a + c.booked, 0) ?? 0;
  const pct = total ? Math.round((booked / total) * 100) : 0;
  return (
    <AdminPage crumbs={[{ label: "Dashboard" }]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Dashboard">Dates are India dates: the 2-per-day limit counts on the mentor's calendar.</PageTitle>
        <Button asChild variant="outline" size="sm"><Link to="/admin/bookings"><CalendarDays />All bookings</Link></Button>
      </div>
      {!d.data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Stat label="Trials today" value={d.data.todayCount} foot={formatDayLong(zonedTime(d.data.today, 720, IST).toJSDate(), IST)} badge={<Badge>India</Badge>} />
            <Stat label="Next 7 days" value={d.data.next7DaysCount} foot="Confirmed, all mentors" />
            <Stat label="Capacity used" value={`${pct}%`} foot={`${booked} of ${total} trials in 14 days`} badge={<Badge variant={pct > 70 ? "warning" : "success"}>{pct > 70 ? "Busy" : "Healthy"}</Badge>} />
            <Stat label="Fully booked days" value={d.data.fullyBookedIstDates.length} foot={d.data.fullyBookedIstDates.length ? "Consider adding shifts" : "None in the next 14 days"} badge={d.data.fullyBookedIstDates.length ? <Badge variant="destructive">Action</Badge> : undefined} />
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
            <CardContent><CapacityChart data={d.data.capacity} /></CardContent>
          </Card>
        </>
      )}
      <h2 className="text-base font-semibold">Up next</h2>
      {next.data ? <BookingsTable rows={next.data.items} /> : <Loading />}
    </AdminPage>
  );
}

export function BookingsPage() {
  const [scope, setScope] = useState("upcoming");
  const [status, setStatus] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [q, setQ] = useState("");
  const mentors = useQuery({ queryKey: ["admin-mentors"], queryFn: () => api.get<MentorRow[]>("/admin/mentors") });
  const list = useQuery({
    queryKey: ["admin-bookings", scope, status, mentorId, q],
    queryFn: () => api.get<Paged<AdminBookingDto>>("/admin/bookings", { scope, status, mentorId, q, pageSize: 100 }),
    placeholderData: prev => prev
  });
  const sel = "h-8 w-auto border-dashed text-[13px]";
  return (
    <AdminPage crumbs={[{ label: "Bookings" }]}>
      <PageTitle title="Bookings">Search, filter and manage every trial.</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-[340px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Search bookings" placeholder="Search reference, parent, email, child…" className="pl-8" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <NativeSelect aria-label="When" className={sel} value={scope} onChange={e => setScope(e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All dates</option></NativeSelect>
        <NativeSelect aria-label="Status" className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="">Any status</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option></NativeSelect>
        <NativeSelect aria-label="Mentor" className={sel} value={mentorId} onChange={e => setMentorId(e.target.value)}><option value="">All mentors</option>{mentors.data?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect>
        <span className="ml-auto text-[13px] text-muted-foreground">{list.data ? `${list.data.total} result${list.data.total === 1 ? "" : "s"}` : ""}</span>
      </div>
      {list.data ? <BookingsTable rows={list.data.items} /> : <Loading />}
    </AdminPage>
  );
}

export function ParentsPage() {
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin-parents", q], queryFn: () => api.get<Paged<ParentRow>>("/admin/parents", { q, pageSize: 100 }), placeholderData: p => p });
  return (
    <AdminPage crumbs={[{ label: "Parents" }]}>
      <PageTitle title="Parents">Guest booked without an account · Pending signed up, email not verified · Verified can see their bookings.</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-[340px] flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search parents" placeholder="Search name or email…" className="pl-8" value={q} onChange={e => setQ(e.target.value)} /></div>
        <span className="ml-auto text-[13px] text-muted-foreground">{list.data?.total ?? ""} parents</span>
      </div>
      {!list.data ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-[13.5px] tabular-nums">
            <thead><tr className="[&_th]:h-10 [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground"><th>Parent</th><th>Account</th><th>Bookings</th><th>Upcoming</th><th>Time zone</th></tr></thead>
            <tbody>
              {list.data.items.map(p => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/50 [&_td]:px-3 [&_td]:py-2.5">
                  <td><Link to={`/admin/parents/${p.id}`} className="flex items-center gap-2"><Avatar name={p.name} size="sm" /><span><span className="block font-medium hover:underline">{p.name}</span><span className="text-[12.5px] text-muted-foreground">{p.email}</span></span></Link></td>
                  <td><AccountBadge status={p.status} /></td><td>{p.bookingCount}</td><td>{p.upcomingCount}</td>
                  <td className="text-[12.5px] text-muted-foreground">{p.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}

export function ParentDetailPage() {
  const { id = "" } = useParams();
  const d = useQuery({ queryKey: ["admin-parent", id], queryFn: () => api.get<ParentDetail>(`/admin/parents/${id}`) });
  const p = d.data?.parent;
  return (
    <AdminPage crumbs={[{ label: "Parents", to: "/admin/parents" }, { label: p?.name ?? "Parent" }]}>
      {!d.data || !p ? <Loading /> : (
        <>
          <Card><CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5"><Avatar name={p.name} size="lg" /><div className="flex flex-col"><h1 className="text-xl font-semibold">{p.name}</h1><span className="text-[13px] text-muted-foreground">{p.email}{p.phone ? ` · ${p.phone}` : ""}</span><span className="text-[13px] text-muted-foreground">{formatZoneLabel(p.timezone === "UTC" ? "Etc/UTC" : p.timezone, new Date())}</span></div></div>
            <AccountBadge status={p.status} />
          </CardContent></Card>
          <h2 className="text-base font-semibold">Bookings <span className="font-normal text-muted-foreground">{d.data.bookings.length}</span></h2>
          <BookingsTable rows={d.data.bookings} />
        </>
      )}
    </AdminPage>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  const full = value >= max;
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-brand")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}
const shiftText = (s: MentorRow["weeklyShift"]) => (s[0] ? `${to12(s[0].start)} – ${to12(s[0].end)}` : "No shift");

export function MentorsPage() {
  const list = useQuery({ queryKey: ["admin-mentors"], queryFn: () => api.get<MentorRow[]>("/admin/mentors") });
  return (
    <AdminPage crumbs={[{ label: "Mentors" }]}>
      <PageTitle title="Mentors">Today in India: {formatDayLong(new Date(), IST)}. Each mentor takes up to 2 trials per India date.</PageTitle>
      {!list.data ? <Loading /> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
          {list.data.map(m => {
            const daysOff = [1, 2, 3, 4, 5, 6, 7].filter(d => !m.weeklyShift.some(s => s.weekday === d)).map(d => WEEKDAYS[d]).join(", ");
            return (
              <Card key={m.id}><CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3"><Avatar name={m.name} /><div className="flex min-w-0 flex-col"><Link to={`/admin/mentors/${m.id}`} className="font-semibold hover:underline">{m.name}</Link><span className="text-xs text-muted-foreground">{m.shiftLabel} · {shiftText(m.weeklyShift)} IST</span></div></div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">Today</span>
                    {m.onShiftToday ? <span className="font-medium tabular-nums">{m.todayBooked} / {m.maxDailyTrials}{m.todayBooked >= m.maxDailyTrials && <Badge variant="destructive" className="ml-1.5">Full</Badge>}</span> : <Badge variant="secondary">Day off</Badge>}
                  </div>
                  <Progress value={m.onShiftToday ? m.todayBooked : 0} max={m.maxDailyTrials} />
                </div>
                <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">{m.upcomingCount} upcoming · off {daysOff || "none"}</span><Button asChild variant="outline" size="sm"><Link to={`/admin/mentors/${m.id}`}>Schedule</Link></Button></div>
              </CardContent></Card>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}

export function MentorDetailPage() {
  const { id = "" } = useParams();
  const s = useQuery({ queryKey: ["admin-mentor", id], queryFn: () => api.get<MentorSchedule>(`/admin/mentors/${id}/schedule`, { days: 14 }) });
  const m = s.data?.mentor;
  return (
    <AdminPage crumbs={[{ label: "Mentors", to: "/admin/mentors" }, { label: m?.name ?? "Mentor" }]}>
      {!s.data || !m ? <Loading /> : (
        <>
          <Card><CardContent className="flex flex-wrap items-center gap-3.5"><Avatar name={m.name} size="lg" /><div className="flex min-w-0 flex-col"><h1 className="text-xl font-semibold">{m.name}</h1><span className="text-[13px] text-muted-foreground">{m.bio}</span></div><Badge variant="brand" className="ml-auto">{m.shiftLabel}</Badge></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>Weekly shift</CardTitle><CardDescription>India Standard Time (UTC+05:30)</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(d => { const sh = s.data.weeklyShift.find(x => x.weekday === d); return (
                  <div key={d} className={cn("rounded-lg border border-border px-1.5 py-2.5 text-center text-xs", sh && "border-transparent bg-brand-soft text-brand-text")}>
                    <b className="mb-0.5 block text-[12.5px] text-foreground">{WEEKDAYS[d]}</b>{sh ? `${to12(sh.start)}–${to12(sh.end)}` : "Off"}
                  </div>
                ); })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Schedule</CardTitle><CardDescription>Next 14 India dates</CardDescription></CardHeader>
            <CardContent className="pt-2">
              {s.data.days.map(d => (
                <div key={d.istDate} className="grid grid-cols-1 gap-4 border-b border-border py-3.5 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)]">
                  <div className="flex flex-col gap-1.5">
                    <strong>{formatDay(zonedTime(d.istDate, 720, IST).toJSDate(), IST)}</strong>
                    {d.onShift ? <><span className="text-xs text-muted-foreground">{d.booked} / {d.max} trials</span><Progress value={d.booked} max={d.max} /></> : <Badge variant="secondary" className="self-start">Day off</Badge>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {d.bookings.length ? d.bookings.map(b => (
                      <div key={b.reference} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="flex min-w-0 flex-col"><span><strong className="tabular-nums">{formatTime(b.startUtc, IST)}</strong> · {b.child.name} <span className="text-muted-foreground">(Grade {b.child.grade})</span></span><span className="text-xs text-muted-foreground">Parent's time {formatSlot(b.startUtc, b.parentTimezone)} · {b.parent.name}</span></div>
                        <Button asChild variant="ghost" size="sm"><Link to={`/admin/bookings/${b.reference}`}>Open</Link></Button>
                      </div>
                    )) : d.onShift ? <span className="pt-0.5 text-[13px] text-muted-foreground">No trials booked</span> : null}
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

export function OutboxPage() {
  const q = useQuery({ queryKey: ["admin-outbox"], queryFn: () => api.get<Paged<OutboxDto>>("/admin/outbox", { pageSize: 80 }) });
  return (
    <AdminPage crumbs={[{ label: "Outbox" }]}>
      <PageTitle title="Outbox">Every email the system would send: confirmations, cancellations and account emails.</PageTitle>
      {q.data ? <OutboxList items={q.data.items} /> : <Loading />}
    </AdminPage>
  );
}
