import type { AdminUser } from "@prisma/client";
import type { Deps } from "@/container";
import { AppError } from "@/http/errors";
import type { AdminsRepository } from "./admins.repository";
import { hashPassword, verifyPassword } from "./passwords";
import type { SessionService } from "./session.service";

export class AdminAuthService {
  constructor(private deps: Deps, private admins: AdminsRepository, private sessions: SessionService) {}

  /** Create or refresh the admin account from ADMIN_EMAIL / ADMIN_PASSWORD. */
  async ensureAdmin(): Promise<AdminUser> {
    const { email, password, name } = this.deps.config.admin;
    return this.admins.upsert(email, name, await hashPassword(password));
  }

  async login(email: string, password: string): Promise<{ admin: AdminUser; token: string; expiresAt: Date }> {
    const admin = await this.admins.findByEmail(email);
    const ok = await verifyPassword(admin?.passwordHash, password);
    if (!admin || !ok) throw new AppError("INVALID_CREDENTIALS", 401);
    return { admin, ...(await this.sessions.create("ADMIN", admin.id)) };
  }
}
