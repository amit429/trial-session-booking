import type { OutboxDto } from "@shared";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { MessageBody } from "@/components/booking/MessageBody";

export function OutboxList({ items }: { items: OutboxDto[] }) {
  if (!items.length) {
    return <Card><EmptyState icon={<Inbox />} title="No messages yet"><p className="text-[13px] text-muted-foreground">Book a trial or sign up to see emails here.</p></EmptyState></Card>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map(m => (
        <article key={m.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className="font-mono">{m.kind}</Badge>
            <span className="text-xs text-muted-foreground">To {m.toEmail} · {new Date(m.createdAt).toLocaleString()}</span>
          </div>
          <strong>{m.subject}</strong>
          <MessageBody body={m.body} />
        </article>
      ))}
    </div>
  );
}
