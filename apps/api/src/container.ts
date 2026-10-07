import type { Clock } from "./clock";
import type { Config } from "./config";
import type { Db } from "./db";
import { logger, type Logger } from "./logger";
import { AdminAuthService } from "./services/adminAuthService";
import { AdminService } from "./services/adminService";
import { BookingService } from "./services/bookingService";
import { OutboxService } from "./services/outboxService";
import { ParentAuthService } from "./services/parentAuthService";
import { SessionService } from "./services/sessionService";
import { SlotService } from "./services/slotService";
import { SuggestionService } from "./services/suggestionService";

export type Deps = { db: Db; clock: Clock; config: Config; logger: Logger };

/** Single composition root: wires services by hand so tests can swap the clock and database. */
export function buildContainer(input: { db: Db; clock: Clock; config: Config; logger?: Logger }) {
  const deps: Deps = { ...input, logger: input.logger ?? logger };
  const slots = new SlotService(deps);
  const suggestions = new SuggestionService(deps, slots);
  const outbox = new OutboxService(deps);
  const bookings = new BookingService(deps, slots, suggestions, outbox);
  const sessions = new SessionService(deps);
  const parentAuth = new ParentAuthService(deps, sessions, outbox);
  const adminAuth = new AdminAuthService(deps, sessions);
  const admin = new AdminService(deps, bookings);
  return { ...deps, slots, suggestions, outbox, bookings, sessions, parentAuth, adminAuth, admin };
}
export type Container = ReturnType<typeof buildContainer>;
