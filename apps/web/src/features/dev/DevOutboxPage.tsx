import { useQuery } from "@tanstack/react-query";
import type { OutboxDto } from "@shared";
import { PublicLayout } from "@/components/SiteHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Busy, MessagesSkeleton } from "@/components/skeletons";
import { api } from "@/lib/api";
import { OutboxList } from "./OutboxList";

/** Development-only inbox (FR-20): emails land here so verify, reset and manage links can be clicked. */
export function DevOutboxPage() {
  const q = useQuery({ queryKey: ["dev-outbox"], queryFn: () => api.get<OutboxDto[]>("/dev/outbox", { limit: 60 }), refetchInterval: 4000, retry: false });
  return (
    <PublicLayout narrow>
      <div className="mb-6 flex flex-col gap-1.5">
        <Badge variant="warning" className="self-start">Development only</Badge>
        <h1 className="text-[28px] font-semibold">Dev outbox</h1>
        <p className="text-muted-foreground">This app doesn't send real email. Messages land here so you can open verification, reset and manage links.</p>
      </div>
      {q.isError ? <Alert variant="warning" title="The dev outbox is turned off">Set DEV_OUTBOX_ENABLED=true in .env and restart the API.</Alert>
        : q.data ? <OutboxList items={q.data} /> : <Busy><MessagesSkeleton /></Busy>}
    </PublicLayout>
  );
}
