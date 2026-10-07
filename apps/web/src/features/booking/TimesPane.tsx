import { formatDayLong, formatTime, formatZoneLabel, timeOfDayGroup, zonedTime, type DaySlotsDto, type SlotDto } from "@trial/shared";
import { Ban } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const GROUPS = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening · after school"]] as const;

export function TimesPane({ tz, day, h24, setH24, onPick, onFull, activeFull, override }: {
  tz: string; day: DaySlotsDto; h24: boolean; setH24: (v: boolean) => void; onPick: (s: SlotDto) => void; onFull: (s: SlotDto) => void; activeFull?: string | null; override?: ReactNode;
}) {
  const dt = zonedTime(day.date, 720, tz);
  return (
    <div className="min-w-0 p-6">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{dt.toFormat("ccc")} <span className="font-medium text-muted-foreground">{dt.toFormat("d LLL")}</span></h3>
        <Tabs label="Clock format" value={h24 ? "24" : "12"} onChange={v => setH24(v === "24")} items={[{ value: "12", label: "12h" }, { value: "24", label: "24h" }]} />
      </div>
      {override ?? (day.status === "CLOSED" ? (
        <EmptyState icon={<Ban />} title="No classes this day"><p className="text-[13px] text-muted-foreground">No mentor works at family-friendly hours for your time zone.</p></EmptyState>
      ) : (
        <div className="-mr-1 flex max-h-[470px] flex-col gap-2 overflow-y-auto pr-1">
          {GROUPS.map(([key, label]) => {
            const g = day.slots.filter(s => timeOfDayGroup(s.startUtc, tz) === key);
            if (!g.length) return null;
            return [
              <p key={key} className="px-0.5 pt-1.5 text-xs font-medium text-muted-foreground">{label}</p>,
              ...g.map(s => {
                const full = s.status === "FULL";
                const last = !full && s.availableMentors === 1;
                return (
                  <button
                    key={s.startUtc}
                    type="button"
                    onClick={() => (full ? onFull(s) : onPick(s))}
                    aria-label={`${formatDayLong(new Date(s.startUtc), tz)}, ${formatTime(s.startUtc, tz)} ${formatZoneLabel(tz, new Date(s.startUtc))}${full ? ", full, show other times" : last ? ", last spot" : ""}`}
                    className={cn(
                      "relative flex h-[42px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] border border-border bg-background font-semibold tabular-nums transition-colors hover:border-brand hover:text-brand-text",
                      full && "border-dashed bg-muted font-medium text-muted-foreground hover:border-ring hover:text-foreground",
                      activeFull === s.startUtc && "border-brand shadow-[0_0_0_3px_var(--brand-ring)]"
                    )}
                  >
                    {formatTime(s.startUtc, tz, h24)}
                    {full && <span className="absolute right-2.5 text-[11px] font-medium text-destructive-text">Full</span>}
                    {last && <span className="absolute right-2.5 text-[11px] font-medium text-warning-text">1 left</span>}
                  </button>
                );
              })
            ];
          })}
        </div>
      ))}
    </div>
  );
}
