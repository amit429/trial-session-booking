import type { AuthTokenPurpose, Parent } from "@prisma/client";
import { HOUR_MS } from "@shared";
import type { Deps } from "@/container";
import { hashToken, newToken } from "@/domain/security/tokens";
import { AppError } from "@/http/errors";
import { accountStatus } from "@/modules/bookings";
import type { OutboxService } from "@/modules/outbox";
import type { ParentsRepository } from "@/modules/parents";
import type { AuthTokensRepository } from "./auth-tokens.repository";
import { hashPassword, verifyPassword } from "./passwords";
import type { SessionService } from "./session.service";

const TOKEN_HOURS: Record<AuthTokenPurpose, number> = { VERIFY_EMAIL: 24, RESET_PASSWORD: 1 };

/** Optional parent accounts: sign-up, email verification, sign-in and password reset (PRD §9). */
export class ParentAuthService {
  constructor(
    private deps: Deps,
    private parents: ParentsRepository,
    private tokens: AuthTokensRepository,
    private sessions: SessionService,
    private outbox: OutboxService
  ) {}

  private now() {
    return this.deps.clock.now();
  }

  /** New single-use token for a purpose; older unused ones stop working. */
  private async issue(parentId: string, purpose: AuthTokenPurpose) {
    const now = this.now();
    await this.tokens.retireUnused(parentId, purpose, now);
    const token = newToken();
    await this.tokens.create(parentId, purpose, hashToken(token), new Date(now.getTime() + TOKEN_HOURS[purpose] * HOUR_MS));
    return token;
  }

  private async consume(token: string, purpose: AuthTokenPurpose) {
    const row = await this.tokens.findByHash(hashToken(token));
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= this.now()) throw new AppError("TOKEN_INVALID", 400);
    if (!(await this.tokens.claim(row.id, this.now()))) throw new AppError("TOKEN_INVALID", 400);
    return row;
  }

  /** Always succeeds from the caller's point of view, so it never reveals which emails have accounts. */
  async signup(name: string, email: string, password: string) {
    const existing = await this.parents.findByEmail(email);
    if (existing && accountStatus(existing) === "VERIFIED") {
      await this.outbox.accountExists(email);
      return;
    }
    const parent = await this.parents.upsertPendingAccount(email, name, await hashPassword(password));
    await this.outbox.verifyEmail(email, name, await this.issue(parent.id, "VERIFY_EMAIL"));
  }

  async resendVerification(email: string) {
    const p = await this.parents.findByEmail(email);
    if (p && accountStatus(p) === "PENDING") await this.outbox.verifyEmail(email, p.name, await this.issue(p.id, "VERIFY_EMAIL"));
  }

  async verify(token: string) {
    const row = await this.consume(token, "VERIFY_EMAIL");
    await this.parents.markVerified(row.parentId, this.now());
  }

  async login(email: string, password: string): Promise<{ parent: Parent; token: string; expiresAt: Date }> {
    const p = await this.parents.findByEmail(email);
    const ok = await verifyPassword(p?.passwordHash, password);
    if (!p || !ok) throw new AppError("INVALID_CREDENTIALS", 401);
    if (!p.emailVerifiedAt) throw new AppError("EMAIL_NOT_VERIFIED", 403);
    return { parent: p, ...(await this.sessions.create("PARENT", p.id)) };
  }

  async forgotPassword(email: string) {
    const p = await this.parents.findByEmail(email);
    if (p?.passwordHash) await this.outbox.resetPassword(email, await this.issue(p.id, "RESET_PASSWORD"));
  }

  /** New password. The link proves inbox access, so the email counts as verified. Ends every session. */
  async resetPassword(token: string, password: string) {
    const row = await this.consume(token, "RESET_PASSWORD");
    const p = await this.parents.findById(row.parentId);
    if (!p) throw new AppError("TOKEN_INVALID", 400);
    if (password.toLowerCase() === p.email) {
      throw new AppError("VALIDATION", 422, undefined, { fieldErrors: { password: "Password can't be your email" } });
    }
    await this.parents.setPassword(p.id, await hashPassword(password), p.emailVerifiedAt ?? this.now());
    await this.sessions.destroyAllForParent(p.id);
  }
}
