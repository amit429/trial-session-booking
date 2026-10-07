import { cn, initials } from "@/lib/utils";

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-7 text-[11px]", md: "size-9 text-[13px]", lg: "size-12 text-[15px]" }[size];
  return <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full border-2 border-card bg-brand-soft font-semibold text-brand-text", s, className)}>{initials(name)}</span>;
}
