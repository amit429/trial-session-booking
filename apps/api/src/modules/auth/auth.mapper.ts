import type { AdminUser, Parent } from "@prisma/client";
import type { AdminDto, ParentDto } from "@shared";
import { accountStatus } from "@/modules/bookings";

export const toParentDto = (p: Parent): ParentDto => ({
  id: p.id,
  name: p.name,
  email: p.email,
  timezone: p.timezone,
  status: accountStatus(p)
});
export const toAdminDto = (a: AdminUser): AdminDto => ({ id: a.id, name: a.name, email: a.email });
