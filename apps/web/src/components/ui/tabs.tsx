import { cn } from "@/lib/utils";

export function Tabs<T extends string>({ value, onChange, items, label, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[]; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex gap-0.5 rounded-[9px] bg-muted p-[3px]", className)}>
      {items.map(i => (
        <button
          key={i.value}
          role="tab"
          type="button"
          aria-selected={i.value === value}
          onClick={() => onChange(i.value)}
          className="h-[30px] cursor-pointer rounded-[7px] px-3 text-[13px] font-medium text-muted-foreground aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-xs"
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
