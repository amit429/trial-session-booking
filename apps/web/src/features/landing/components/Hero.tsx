import { formatDayLong, formatTime, formatZoneLabel, zoneAbbreviation } from "@shared";
import { ArrowRight, CalendarCheck, Clock, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { useTimezone } from "@/hooks/useTimezone";
import { useAuth } from "@/lib/session";
import { useNextOpenTimes } from "../api/landing.api";

const MENTORS = ["Aarav Sharma", "Priya Iyer", "Vikram Nair", "Sneha Kulkarni", "Meera Pillai"];

/** Live preview of real open times in the visitor's own zone: the product's main promise, shown not told. */
function TimesPreview() {
  const { tz } = useTimezone();
  const times = useNextOpenTimes(tz);
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"><Globe className="size-4" />{tz ? formatZoneLabel(tz, new Date()) : "Your time zone"}</div>
        <Badge variant="success" dot>Open now</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold">Next free trial times</p>
      <div className="mt-3 flex flex-col gap-2">
        {times.data
          ? times.data.map(s => (
              <Link key={s.startUtc} to="/book" className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-brand hover:bg-brand-soft">
                <span className="flex flex-col">
                  <span className="font-semibold tabular-nums">{formatTime(s.startUtc, tz ?? "UTC")} {zoneAbbreviation(tz ?? "UTC", s.startUtc)}</span>
                  <span className="text-xs text-muted-foreground">{formatDayLong(s.startUtc, tz ?? "UTC")}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))
          : [0, 1, 2].map(i => <Skeleton key={i} className="h-[54px] rounded-lg" />)}
        {times.data && times.data.length === 0 && <p className="text-[13px] text-muted-foreground">We're fully booked right now. Check back soon.</p>}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
        <Clock className="size-4 shrink-0" />60-minute class · mentor assigned automatically
      </div>
    </div>
  );
}

export function Hero() {
  const { parent } = useAuth();
  return (
    <section className="relative overflow-hidden border-b border-border bg-background px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 py-16 md:grid-cols-[minmax(0,1fr)_400px] md:py-24">
        <div className="flex flex-col gap-6">
          <Badge variant="brand" className="self-start"><CalendarCheck />Free 1:1 trial class · 60 minutes</Badge>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            A free Coding or Maths class, at a time that suits your family
          </h1>
          <p className="max-w-[56ch] text-base text-muted-foreground sm:text-lg">
            Pick a time in your own time zone. We match an expert mentor who's free then, and send the class link and a calendar invite straight away.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="brand" size="lg"><Link to="/book">Book a free trial <ArrowRight /></Link></Button>
            {parent ? (
              <Button asChild variant="outline" size="lg"><Link to="/my-bookings">My bookings</Link></Button>
            ) : (
              <Button asChild variant="outline" size="lg"><Link to="/login">Sign in</Link></Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            <div className="flex" aria-hidden>{MENTORS.map((n, i) => <Avatar key={n} name={n} size="sm" className={i ? "-ml-2" : ""} />)}</div>
            <span>10 mentors · families in the US, UK and Ireland · no payment or account needed</span>
          </div>
        </div>
        <TimesPreview />
      </div>
    </section>
  );
}
