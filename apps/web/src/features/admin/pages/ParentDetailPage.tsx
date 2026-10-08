import { formatZoneLabel } from "@shared";
import { useParams } from "react-router-dom";
import { AccountBadge } from "@/components/booking";
import { Busy } from "@/components/feedback/skeletons";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, Skeleton } from "@/components/ui/card";
import { useAdminParent } from "../api/admin.api";
import { AdminPage } from "../components/AdminPage";
import { BookingsTable } from "../components/BookingsTable";
import { TableSkeleton } from "../components/TableSkeleton";

export function ParentDetailPage() {
  const { id = "" } = useParams();
  const query = useAdminParent(id);
  const p = query.data?.parent;

  return (
    <AdminPage crumbs={[{ label: "Parents", to: "/admin/parents" }, { label: p?.name ?? "Parent" }]}>
      {!query.data || !p ? (
        <Busy>
          <div className="flex flex-col gap-5">
            <Card>
              <CardContent className="flex items-center gap-3.5">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
              </CardContent>
            </Card>
            <Skeleton className="h-5 w-28" />
            <TableSkeleton rows={3} />
          </div>
        </Busy>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Avatar name={p.name} size="lg" />
                <div className="flex flex-col">
                  <h1 className="text-xl font-semibold">{p.name}</h1>
                  <span className="text-[13px] text-muted-foreground">
                    {p.email}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {formatZoneLabel(p.timezone === "UTC" ? "Etc/UTC" : p.timezone, new Date())}
                  </span>
                </div>
              </div>
              <AccountBadge status={p.status} />
            </CardContent>
          </Card>
          <h2 className="text-base font-semibold">
            Bookings <span className="font-normal text-muted-foreground">{query.data.bookings.length}</span>
          </h2>
          <BookingsTable rows={query.data.bookings} />
        </>
      )}
    </AdminPage>
  );
}
