import * as Popover from "@radix-ui/react-popover";
import { PINNED_ZONES, ZONE_NAMES, formatOffset, formatZoneLabel, offsetMinutes } from "@shared";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

const ALL: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return PINNED_ZONES;
  }
})();

const nameOf = (z: string) => ZONE_NAMES[z] ?? z.replace(/_/g, " ").replace("/", " / ");

export function TimezonePicker({ tz, onChange, defaultOpen }: { tz: string | null; onChange: (z: string) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [q, setQ] = useState("");
  const now = new Date();
  const { pinned, rest } = useMemo(() => {
    const f = q.trim().toLowerCase();
    const match = (z: string) => !f || z.toLowerCase().includes(f) || nameOf(z).toLowerCase().includes(f);
    return { pinned: PINNED_ZONES.filter(match), rest: ALL.filter(z => !PINNED_ZONES.includes(z) && match(z)).slice(0, 80) };
  }, [q]);

  const item = (z: string) => (
    <button
      key={z}
      type="button"
      role="option"
      aria-selected={z === tz}
      onClick={() => {
        onChange(z);
        setOpen(false);
        setQ("");
      }}
      className="flex w-full cursor-pointer justify-between gap-3 rounded-md px-2 py-[7px] text-left text-[13.5px] hover:bg-accent aria-selected:bg-brand-soft aria-selected:text-brand-text"
    >
      <span>{nameOf(z)}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{formatOffset(offsetMinutes(now, z))}</span>
    </button>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex cursor-pointer items-center gap-1.5 text-left font-medium text-foreground hover:underline hover:underline-offset-4">
        {tz ? formatZoneLabel(tz, now) : "Choose your time zone"} <ChevronDown className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-2 pb-2 pt-1">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search time zone…"
              aria-label="Search time zones"
              className="h-[30px] w-full bg-transparent outline-none"
            />
          </div>
          <div role="listbox" aria-label="Time zones" className="max-h-[280px] overflow-y-auto pt-1">
            {pinned.length > 0 && <p className="px-2 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground">Suggested</p>}
            {pinned.map(item)}
            {rest.length > 0 && <p className="px-2 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground">All time zones</p>}
            {rest.map(item)}
            {!pinned.length && !rest.length && <p className="p-2.5 text-[13px] text-muted-foreground">No time zone matches “{q}”.</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
