import { useState } from "react";
import { Skeleton } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { useAdminBookings, useAdminMentors, type BookingFilters } from "../api/admin.api";
import { AdminPage, PageTitle } from "../components/AdminPage";
import { BookingsTable } from "../components/BookingsTable";
import { SearchInput } from "../components/SearchInput";
import { TableSkeleton } from "../components/TableSkeleton";

const filterClass = "h-8 w-auto border-dashed text-[13px]";

export function BookingsPage() {
  const [filters, setFilters] = useState<BookingFilters>({ scope: "upcoming", status: "", mentorId: "", q: "" });
  const set = (k: keyof BookingFilters) => (v: string) => setFilters(f => ({ ...f, [k]: v }));
  const mentors = useAdminMentors();
  const list = useAdminBookings(filters);

  return (
    <AdminPage crumbs={[{ label: "Bookings" }]}>
      <PageTitle title="Bookings">Search, filter and manage every trial.</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput label="Search bookings" placeholder="Search reference, parent, email, child…" value={filters.q} onChange={set("q")} />
        <NativeSelect aria-label="When" className={filterClass} value={filters.scope} onChange={e => set("scope")(e.target.value)}>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All dates</option>
        </NativeSelect>
        <NativeSelect aria-label="Status" className={filterClass} value={filters.status} onChange={e => set("status")(e.target.value)}>
          <option value="">Any status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </NativeSelect>
        <NativeSelect aria-label="Mentor" className={filterClass} value={filters.mentorId} onChange={e => set("mentorId")(e.target.value)}>
          <option value="">All mentors</option>
          {mentors.data?.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
        <span className="ml-auto text-[13px] text-muted-foreground">
          {list.data ? `${list.data.total} result${list.data.total === 1 ? "" : "s"}` : <Skeleton className="h-4 w-16" />}
        </span>
      </div>
      {list.data ? (
        <BookingsTable rows={list.data.items} fetching={list.isFetching && list.isPlaceholderData} />
      ) : (
        <TableSkeleton rows={8} />
      )}
    </AdminPage>
  );
}
