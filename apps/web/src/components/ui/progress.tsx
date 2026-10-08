import { cn } from "@/lib/utils";

/** Thin progress bar; turns red when full. */
export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const full = value >= max;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-brand")} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  );
}
