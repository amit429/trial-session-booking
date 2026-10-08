import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function StatCard({ label, value, foot, badge }: { label: string; value: ReactNode; foot: string; badge?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-muted-foreground">{label}</span>{badge}</div>
      <div className="text-[28px] font-semibold tabular-nums tracking-tight">{value}</div>
      <span className="text-xs text-muted-foreground">{foot}</span>
    </Card>
  );
}
