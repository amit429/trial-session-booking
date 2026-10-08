import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "bg-brand-soft", tone: "text-brand-text", Icon: Info },
  warning: { box: "bg-warning-soft", tone: "text-warning-text", Icon: AlertTriangle },
  destructive: { box: "bg-destructive-soft", tone: "text-destructive-text", Icon: XCircle },
  success: { box: "bg-success-soft", tone: "text-success-text", Icon: CheckCircle2 }
};

export function Alert({
  variant = "info",
  title,
  children,
  icon,
  className
}: {
  variant?: keyof typeof styles;
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const s = styles[variant];
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn("grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg px-3.5 py-3 text-[13px]", s.box, className)}
    >
      <span className={cn("mt-0.5 [&_svg]:size-4", s.tone)}>{icon ?? <s.Icon />}</span>
      <p className={cn("text-sm font-semibold", s.tone)}>{title}</p>
      {children && <div className="col-start-2 text-muted-foreground">{children}</div>}
    </div>
  );
}
