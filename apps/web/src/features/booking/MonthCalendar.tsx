import { zonedTime, type DaySlotsDto } from "@trial/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

export function MonthCalendar({ tz, month, days, selected, today, onPick, onMonth }: {
  tz: string; month: string; days: Map<string, DaySlotsDto>; selected: string | null; today: string; onPick: (d: string) => void; onMonth: (delta: number) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mondayFirst = tz.startsWith("Europe/");
  const firstWeekday = zonedTime(`${month}-01`, 720, tz).weekday; // 1 Mon … 7 Sun
  const lead = mondayFirst ? firstWeekday - 1 : firstWeekday % 7;
  const heads = mondayFirst ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const keys = [...days.keys()].sort();
  const minM = keys[0]?.slice(0, 7) ?? month;
  const maxM = keys.at(-1)?.slice(0, 7) ?? month;

  return (
    <div className="min-w-0 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">{MONTH.format(new Date(Date.UTC(y, m - 1, 1)))} <span className="font-medium text-muted-foreground">{y}</span></h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" disabled={month <= minM} onClick={() => onMonth(-1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" disabled={month >= maxM} onClick={() => onMonth(1)}><ChevronRight /></Button>
        </div>
      </div>
      <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-1.5">
        {heads.map(h => <div key={h} className="pb-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{h}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
        {Array.from({ length: nDays }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const info = days.get(date);
          const kind = !info || info.status === "CLOSED" ? "off" : info.status === "FULL" ? "full" : info.slots.filter(s => s.status === "OPEN").length <= 2 ? "few" : "open";
          const isSel = date === selected;
          const label = `${zonedTime(date, 720, tz).toFormat("cccc d LLLL")}${kind === "off" ? ", not bookable" : kind === "full" ? ", fully booked" : kind === "few" ? ", few times left" : ", times available"}`;
          return (
            <button
              key={date}
              type="button"
              disabled={kind === "off"}
              aria-pressed={isSel}
              aria-label={label}
              onClick={() => onPick(date)}
              className={cn(
                "relative aspect-square max-h-[58px] rounded-[9px] text-[15px] font-medium tabular-nums transition-colors",
                kind === "off" && "cursor-default text-muted-foreground opacity-55",
                (kind === "open" || kind === "few") && "cursor-pointer bg-muted font-semibold hover:bg-border",
                kind === "full" && "cursor-pointer text-muted-foreground hover:bg-muted",
                isSel && "bg-brand text-brand-foreground hover:bg-brand",
                date === today && !isSel && "after:pointer-events-none after:absolute after:inset-[3px] after:rounded-[7px] after:border after:border-ring"
              )}
            >
              {i + 1}
              {kind !== "off" && (
                <span className={cn("absolute bottom-1.5 left-1/2 size-[5px] -translate-x-1/2 rounded-full", isSel ? "bg-white" : kind === "full" ? "bg-destructive" : kind === "few" ? "bg-warning" : "bg-success")} />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-[18px] flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-success" />Available</span>
        <span className="flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-warning" />Few left</span>
        <span className="flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-destructive" />Fully booked</span>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">Bookable up to 14 days ahead, at least 2 hours from now.</p>
    </div>
  );
}
