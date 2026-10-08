import { verifyManageToken } from "@/domain/security/tokens";
import type { FullBooking } from "./bookings.repository";

/** Who is asking to see a booking. */
export type Viewer = { token?: string; parentId?: string; isAdmin?: boolean };

/** A booking is visible to its private-link holder, its verified owner, or an admin (PRD §9.3). */
export function canView(b: FullBooking, viewer: Viewer, secret: string): boolean {
  if (viewer.isAdmin) return true;
  if (viewer.token && verifyManageToken(secret, b.id, viewer.token)) return true;
  return !!viewer.parentId && viewer.parentId === b.parentId && !!b.parent.emailVerifiedAt;
}
