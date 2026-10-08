import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountBadge } from "@/components/booking";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAdminParents } from "../api/admin.api";
import { AdminPage, PageTitle } from "../components/AdminPage";
import { SearchInput } from "../components/SearchInput";
import { tableHeadClass } from "../components/table";
import { TableSkeleton } from "../components/TableSkeleton";

const COLUMNS = ["Parent", "Account", "Bookings", "Upcoming", "Time zone"];

export function ParentsPage() {
  const [q, setQ] = useState("");
  const list = useAdminParents(q);
  const refetching = list.isFetching && list.isPlaceholderData;

  return (
    <AdminPage crumbs={[{ label: "Parents" }]}>
      <PageTitle title="Parents">
        Guest booked without an account · Pending signed up, email not verified · Verified can see their bookings.
      </PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput label="Search parents" placeholder="Search name or email…" value={q} onChange={setQ} />
        <span className="ml-auto text-[13px] text-muted-foreground">{list.data?.total ?? ""} parents</span>
      </div>
      {!list.data ? (
        <TableSkeleton rows={8} cols={COLUMNS} />
      ) : (
        <div
          aria-busy={refetching}
          className={cn("overflow-x-auto rounded-xl border border-border bg-card transition-opacity", refetching && "opacity-60")}
        >
          <table className="w-full text-[13.5px] tabular-nums">
            <thead>
              <tr className={tableHeadClass}>
                {COLUMNS.map(c => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.items.map(p => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/50 [&_td]:px-3 [&_td]:py-2.5">
                  <td>
                    <Link to={`/admin/parents/${p.id}`} className="flex items-center gap-2">
                      <Avatar name={p.name} size="sm" />
                      <span>
                        <span className="block font-medium hover:underline">{p.name}</span>
                        <span className="text-[12.5px] text-muted-foreground">{p.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <AccountBadge status={p.status} />
                  </td>
                  <td>{p.bookingCount}</td>
                  <td>{p.upcomingCount}</td>
                  <td className="text-[12.5px] text-muted-foreground">{p.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
