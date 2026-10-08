import type { Clock } from "@/core/clock";
import type { Config } from "@/core/config";
import type { Db } from "@/core/db";
import { logger, type Logger } from "@/core/logger";
import { AdminRepository, AdminService } from "@/modules/admin";
import { AdminAuthService, AdminsRepository, AuthTokensRepository, ParentAuthService, SessionService, SessionsRepository } from "@/modules/auth";
import { BookingService, BookingsRepository } from "@/modules/bookings";
import { OutboxRepository, OutboxService } from "@/modules/outbox";
import { ParentsRepository } from "@/modules/parents";
import { SlotService, SlotsRepository, SuggestionService } from "@/modules/slots";

export type Deps = { db: Db; clock: Clock; config: Config; logger: Logger };

/** Single composition root: wires repositories and services by hand so tests can swap the clock and database. */
export function buildContainer(input: { db: Db; clock: Clock; config: Config; logger?: Logger }) {
  const deps: Deps = { ...input, logger: input.logger ?? logger };
  const { db } = deps;

  const outbox = new OutboxService(deps, new OutboxRepository(db));
  const slots = new SlotService(deps, new SlotsRepository(db));
  const suggestions = new SuggestionService(deps, slots);
  const bookings = new BookingService(deps, new BookingsRepository(db), slots, suggestions, outbox);
  const parents = new ParentsRepository(db);
  const sessions = new SessionService(deps, new SessionsRepository(db));
  const parentAuth = new ParentAuthService(deps, parents, new AuthTokensRepository(db), sessions, outbox);
  const adminAuth = new AdminAuthService(deps, new AdminsRepository(db), sessions);
  const admin = new AdminService(deps, new AdminRepository(db), parents, bookings);

  return { ...deps, outbox, slots, suggestions, bookings, sessions, parentAuth, adminAuth, admin };
}
export type Container = ReturnType<typeof buildContainer>;
