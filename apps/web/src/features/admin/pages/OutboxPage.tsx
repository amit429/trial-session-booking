import { OutboxList } from "@/components/booking";
import { Busy, MessagesSkeleton } from "@/components/feedback/skeletons";
import { useAdminOutbox } from "../api/admin.api";
import { AdminPage, PageTitle } from "../components/AdminPage";

export function OutboxPage() {
  const query = useAdminOutbox();
  return (
    <AdminPage crumbs={[{ label: "Outbox" }]}>
      <PageTitle title="Outbox">Every email the system would send: confirmations, cancellations and account emails.</PageTitle>
      {query.data ? <OutboxList items={query.data.items} /> : <Busy><MessagesSkeleton count={5} /></Busy>}
    </AdminPage>
  );
}
