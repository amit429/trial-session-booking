import { Skeleton } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BOOKING_COLUMNS, tableHeadClass } from "./table";


/** Placeholder rows shaped like the real table. */
export function TableSkeleton({ rows = 6, cols = BOOKING_COLUMNS }: { rows?: number; cols?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card" aria-busy="true" aria-label="Loading">
      <table className="w-full text-[13.5px]">
        <thead><tr className={tableHeadClass}>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-border last:border-b-0">
              {cols.map((c, i) => (
                <td key={c} className="px-3 py-3">
                  <Skeleton className={cn("h-4", i === 0 ? "w-20" : "w-24")} />
                  {i > 0 && i < cols.length - 1 && <Skeleton className="mt-1.5 h-3 w-16" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
