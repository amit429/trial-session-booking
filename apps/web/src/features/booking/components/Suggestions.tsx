import { formatClockMinutes, formatDay, formatDayLong, formatTime, zoneAbbreviation, zonedTime, type SuggestionsResponse } from "@shared";
import { ArrowLeft, ArrowRight, Info, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function Suggestions({
  tz,
  data,
  lead,
  onPick,
  onBack,
  h24 = false
}: {
  tz: string;
  data: SuggestionsResponse;
  lead?: string;
  onPick: (startUtc: string) => void;
  onBack?: () => void;
  h24?: boolean;
}) {
  const [hh, mm] = data.requested.time.split(":").map(Number);
  const T = formatClockMinutes(hh * 60 + mm);
  const D = formatDay(zonedTime(data.requested.date, 720, tz).toJSDate(), tz);
  const head: Record<SuggestionsResponse["strategy"], [string, string]> = {
    SAME_DAY: [`${T} is taken`, `No mentor is free then on ${D}. These times that day are open:`],
    SAME_TIME: [`${D} is fully booked`, `${T} is open on these days:`],
    NEAREST: [`${T} isn't available nearby`, "Here are the closest good times:"],
    NONE: ["We're fully booked for the next two weeks", "Please check back soon, or email hello@trialdesk.example and we'll find a time."]
  };
  const [title, desc] = head[data.strategy];
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <Alert variant={lead ? "destructive" : "warning"} title={lead ?? title} icon={lead ? <XCircle /> : <Info />}>
        {lead ? `${title}. ${desc}` : desc}
      </Alert>
      {data.notes.map(n => (
        <p key={n.message} className="text-xs text-warning-text">
          {n.message}
        </p>
      ))}
      {data.suggestions.map(s => (
        <button
          key={s.startUtc}
          type="button"
          onClick={() => onPick(s.startUtc)}
          className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-soft"
        >
          <span className="flex flex-col">
            <span className="font-semibold tabular-nums">
              {formatTime(s.startUtc, tz, h24)} {zoneAbbreviation(tz, new Date(s.startUtc))}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {formatDayLong(new Date(s.startUtc), tz)}
              {s.availableMentors === 1 ? " · last spot" : ""}
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </button>
      ))}
      {onBack && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
          <ArrowLeft />
          All times
        </Button>
      )}
    </div>
  );
}
