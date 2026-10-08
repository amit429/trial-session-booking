import type { Db } from "@/core/db";
import type { DbClient } from "@/core/types";
import type { OutboxDraft } from "./outbox.templates";

const withReference = { booking: { select: { reference: true } } } as const;

export class OutboxRepository {
  constructor(private db: Db) {}

  createMany(drafts: OutboxDraft[], client: DbClient = this.db) {
    return client.outboxMessage.createMany({ data: drafts });
  }

  recent(limit: number) {
    return this.db.outboxMessage.findMany({ include: withReference, orderBy: { createdAt: "desc" }, take: limit });
  }

  page(page: number, pageSize: number) {
    return Promise.all([
      this.db.outboxMessage.findMany({
        include: withReference,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.outboxMessage.count()
    ]);
  }

  forBooking(bookingId: string) {
    return this.db.outboxMessage.findMany({ where: { bookingId }, include: withReference, orderBy: { createdAt: "asc" } });
  }
}
