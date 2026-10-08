import type { Clock } from "@/core/clock";
import type { Config } from "@/core/config";
import type { Db } from "@/core/db";
import { logger, type Logger } from "@/core/logger";
import { AdminAuthService } from "@/modules/auth/admin-auth.service";
import { AdminService } from "@/modules/admin/admin.service";
import { BookingService } from "@/modules/bookings/bookings.service";
import { OutboxService } from "@/modules/outbox/outbox.service";
import { ParentAuthService } from "@/modules/auth/parent-auth.service";
import { SessionService } from "@/modules/auth/session.service";
import { SlotService } from "@/modules/slots/slots.service";
import { SuggestionService } from "@/modules/slots/suggestions.service";

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
