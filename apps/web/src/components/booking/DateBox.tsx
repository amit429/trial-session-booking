/** Small calendar tile ("OCT / 10") for a booking's date in the given zone. */
export function DateBox({ iso, timezone }: { iso: string; timezone: string }) {
  const at = new Date(iso);
  return (
    <div className="w-[52px] overflow-hidden rounded-lg border border-border bg-background text-center" aria-hidden>
      <div className="bg-muted py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: timezone }).format(at)}
      </div>
      <div className="pb-1.5 pt-0.5 text-[19px] font-semibold tabular-nums">{new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: timezone }).format(at)}</div>
    </div>
  );
}
