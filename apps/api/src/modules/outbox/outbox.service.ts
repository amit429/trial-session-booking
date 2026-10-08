import type { OutboxDto, Paged } from "@shared";
import type { Deps } from "@/container";
import type { DbClient } from "@/core/types";
import { toOutboxDto } from "./outbox.mapper";
import type { OutboxRepository } from "./outbox.repository";
import * as templates from "./outbox.templates";

/** Stores every message the system would email (ADR-14) and reads them back for the outbox views. */
export class OutboxService {
  constructor(private deps: Deps, private repo: OutboxRepository) {}

  private url = (path: string) => `${this.deps.config.appBaseUrl}${path}`;

  bookingConfirmed(client: DbClient, b: templates.BookingForMail, manageUrl: string) {
    return this.repo.createMany(templates.bookingConfirmed(b, { manageUrl, signupUrl: this.url("/signup") }), client);
  }

  bookingCancelled(client: DbClient, b: templates.BookingForMail, by: "PARENT" | "ADMIN") {
    return this.repo.createMany(templates.bookingCancelled(b, by, this.url("/book")), client);
  }

  verifyEmail(email: string, name: string, token: string) {
    return this.repo.createMany([templates.verifyEmail(email, name, this.url(`/verify-email?token=${token}`))]);
  }

  accountExists(email: string) {
    return this.repo.createMany([templates.accountExists(email, this.url("/login"), this.url("/forgot-password"))]);
  }

  resetPassword(email: string, token: string) {
    return this.repo.createMany([templates.resetPassword(email, this.url(`/reset-password?token=${token}`))]);
  }

  async recent(limit: number): Promise<OutboxDto[]> {
    return (await this.repo.recent(limit)).map(toOutboxDto);
  }

  async page(page: number, pageSize: number): Promise<Paged<OutboxDto>> {
    const [rows, total] = await this.repo.page(page, pageSize);
    return { items: rows.map(toOutboxDto), total };
  }

  async forBooking(bookingId: string): Promise<OutboxDto[]> {
    return (await this.repo.forBooking(bookingId)).map(toOutboxDto);
  }
}
