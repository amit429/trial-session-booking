import type { Deps } from "@/container";
import { AppError } from "@/http/errors";
import { hashPassword, verifyPassword } from "@/modules/auth/passwords";
import type { SessionService } from "@/modules/auth/session.service";

export class AdminAuthService {
  constructor(private deps: Deps, private sessions: SessionService) {}

  /** Create or refresh the admin account from ADMIN_EMAIL / ADMIN_PASSWORD. */
  async ensureAdmin() {
    const { email, password, name } = this.deps.config.admin;
    const passwordHash = await hashPassword(password);
    return this.deps.db.adminUser.upsert({ where: { email }, create: { email, name, passwordHash }, update: { name, passwordHash } });
  }

  async login(email: string, password: string) {
    const admin = await this.deps.db.adminUser.findUnique({ where: { email } });
    const ok = await verifyPassword(admin?.passwordHash, password);
    if (!admin || !ok) throw new AppError("INVALID_CREDENTIALS", 401);
    return { admin, ...(await this.sessions.create("ADMIN", admin.id)) };
  }
}
