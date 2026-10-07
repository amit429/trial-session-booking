import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 text-xs font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      outline: "border-border text-foreground",
      secondary: "bg-muted text-foreground",
      success: "bg-success-soft text-success-text",
      warning: "bg-warning-soft text-warning-text",
      destructive: "bg-destructive-soft text-destructive-text",
      brand: "bg-brand-soft text-brand-text"
    }
  },
  defaultVariants: { variant: "outline" }
});

export function Badge({ className, variant, dot, children, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ variant }), className)} {...p}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
