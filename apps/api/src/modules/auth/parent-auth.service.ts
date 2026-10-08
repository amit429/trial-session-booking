import type { AuthTokenPurpose, Parent } from "@prisma/client";
import type { ParentDto } from "@shared";
import type { Deps } from "@/container";
import { hashToken, newToken } from "@/domain/security/tokens";
import { AppError } from "@/http/errors";
import { accountStatus } from "@/modules/bookings/bookings.service";
import type { OutboxService } from "@/modules/outbox/outbox.service";
import { hashPassword, verifyPassword } from "@/modules/auth/passwords";
import type { SessionService } from "@/modules/auth/session.service";

const HOURS = { VERIFY_EMAIL: 24, RESET_PASSWORD: 1 } as const;

export const toParentDto = (p: Parent): ParentDto => ({ id: p.id, name: p.name, email: p.email, timezone: p.timezone, status: accountStatus(p) });

export class ParentAuthService {
  constructor(private deps: Deps, private sessions: SessionService, private outbox: OutboxService) {}

  /** New single-use token for a purpose; older unused ones stop working. */
  private async issue(parentId: string, purpose: AuthTokenPurpose) {
    const now = this.deps.clock.now();
    await this.deps.db.authToken.updateMany({ where: { parentId, purpose, usedAt: null }, data: { usedAt: now } });
    const token = newToken();
    await this.deps.db.authToken.create({
      data: { parentId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + HOURS[purpose] * 3_600_000) }
    });
    return token;
  }

  private async consume(token: string, purpose: AuthTokenPurpose) {
    const now = this.deps.clock.now();
    const row = await this.deps.db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) throw new AppError("TOKEN_INVALID", 400);
    const claimed = await this.deps.db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) throw new AppError("TOKEN_INVALID", 400);
    return row;
  }

  /** Always succeeds from the caller's point of view (no account enumeration). */
  async signup(name: string, email: string, password: string) {
    const existing = await this.deps.db.parent.findUnique({ where: { email } });
    if (existing?.passwordHash && existing.emailVerifiedAt) {
      await this.outbox.accountExists(email);
      return;
    }
    const passwordHash = await hashPassword(password);
    const parent = await this.deps.db.parent.upsert({
      where: { email },
      create: { name, email, timezone: "UTC", passwordHash },
      update: { name, passwordHash, emailVerifiedAt: null }
    });
    await this.outbox.verifyEmail(email, name, await this.issue(parent.id, "VERIFY_EMAIL"));
  }

  async resendVerification(email: string) {
    const p = await this.deps.db.parent.findUnique({ where: { email } });
    if (p && accountStatus(p) === "PENDING") await this.outbox.verifyEmail(email, p.name, await this.issue(p.id, "VERIFY_EMAIL"));
  }

  async verify(token: string) {
    const row = await this.consume(token, "VERIFY_EMAIL");
    await this.deps.db.parent.update({ where: { id: row.parentId }, data: { emailVerifiedAt: this.deps.clock.now() } });
  }

  async login(email: string, password: string) {
    const p = await this.deps.db.parent.findUnique({ where: { email } });
    const ok = await verifyPassword(p?.passwordHash, password);
    if (!p || !ok) throw new AppError("INVALID_CREDENTIALS", 401);
    if (!p.emailVerifiedAt) throw new AppError("EMAIL_NOT_VERIFIED", 403);
    const session = await this.sessions.create("PARENT", p.id);
    return { parent: p, ...session };
  }

  async forgotPassword(email: string) {
    const p = await this.deps.db.parent.findUnique({ where: { email } });
    if (p?.passwordHash) await this.outbox.resetPassword(email, await this.issue(p.id, "RESET_PASSWORD"));
  }

  /** New password; the link proves inbox access, so the email counts as verified. Ends every session. */
  async resetPassword(token: string, password: string) {
    const row = await this.consume(token, "RESET_PASSWORD");
    const p = await this.deps.db.parent.findUniqueOrThrow({ where: { id: row.parentId } });
    if (password.toLowerCase() === p.email) {
      throw new AppError("VALIDATION", 422, undefined, { fieldErrors: { password: "Password can't be your email" } });
    }
    await this.deps.db.parent.update({
      where: { id: p.id },
      data: { passwordHash: await hashPassword(password), emailVerifiedAt: p.emailVerifiedAt ?? this.deps.clock.now() }
    });
    await this.sessions.destroyAllForParent(p.id);
  }
}
