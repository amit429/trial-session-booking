import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-ring)] focus:outline-none read-only:bg-muted read-only:text-muted-foreground aria-[invalid=true]:border-destructive";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, className)} {...props} />
));
Input.displayName = "Input";

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(field, "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[position:right_10px_center] bg-no-repeat pr-8", className)}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-sm font-medium", className)} {...props} />
);

/** Label + control + description or error, wired for screen readers. */
export function Field({ id, label, error, description, children, className }: { id: string; label: React.ReactNode; error?: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} className={error ? "text-destructive-text" : undefined}>{label}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="text-[13px] font-medium text-destructive-text">{error}</p> : description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
    </div>
  );
}
