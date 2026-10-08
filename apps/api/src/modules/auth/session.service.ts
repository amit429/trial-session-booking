import type { AdminUser, Parent, SessionKind } from "@prisma/client";
import { DAY_MS, HOUR_MS } from "@shared";
import type { Deps } from "@/container";
import { hashToken, newToken } from "@/domain/security/tokens";
import type { SessionsRepository } from "./sessions.repository";

export type ResolvedSession = { parent?: Parent; admin?: AdminUser; renewedUntil?: Date };

/** DB-backed sessions: random token in the cookie, SHA-256 of it in the table (ADR-12). */
export class SessionService {
  constructor(
    private deps: Deps,
    private repo: SessionsRepository
  ) {}

  private ttlMs(kind: SessionKind) {
    const c = this.deps.config;
    return kind === "PARENT" ? c.parentSessionDays * DAY_MS : c.adminSessionHours * HOUR_MS;
  }

  async create(kind: SessionKind, subjectId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const expiresAt = new Date(this.deps.clock.now().getTime() + this.ttlMs(kind));
    await this.repo.create(hashToken(token), kind, subjectId, expiresAt);
    return { token, expiresAt };
  }

  /** The session's subject, or null. Parent sessions slide when less than half their life is left. */
  async resolve(token: string, kind: SessionKind): Promise<ResolvedSession | null> {
    const id = hashToken(token);
    const s = await this.repo.findWithSubject(id);
    if (!s || s.kind !== kind) return null;
    const now = this.deps.clock.now();
    if (s.expiresAt <= now) {
      await this.repo.delete(id);
      return null;
    }
    let renewedUntil: Date | undefined;
    if (kind === "PARENT" && s.expiresAt.getTime() - now.getTime() < this.ttlMs(kind) / 2) {
      renewedUntil = new Date(now.getTime() + this.ttlMs(kind));
      await this.repo.extend(id, renewedUntil);
    }
    return { parent: s.parent ?? undefined, admin: s.admin ?? undefined, renewedUntil };
  }

  destroy(token: string) {
    return this.repo.delete(hashToken(token));
  }

  destroyAllForParent(parentId: string) {
    return this.repo.deleteForParent(parentId);
  }

  purgeExpired() {
    return this.repo.deleteExpired(this.deps.clock.now());
  }
}
