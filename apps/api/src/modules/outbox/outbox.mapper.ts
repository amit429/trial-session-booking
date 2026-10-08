import type { OutboxMessage } from "@prisma/client";
import type { OutboxDto } from "@shared";

export const toOutboxDto = (m: OutboxMessage & { booking?: { reference: string } | null }): OutboxDto => ({
  id: m.id,
  kind: m.kind,
  toEmail: m.toEmail,
  subject: m.subject,
  body: m.body,
  bookingReference: m.booking?.reference ?? null,
  createdAt: m.createdAt.toISOString()
});
