import type { AdminUser, Parent, SessionKind } from "@prisma/client";
import type { Deps } from "../container";
import { hashToken, newToken } from "../domain/tokens";

/** DB-backed sessions: random token in the cookie, SHA-256 of it in the table (ADR-12). */
export class SessionService {
  constructor(private deps: Deps) {}

  private ttlMs(kind: SessionKind) {
    const c = this.deps.config;
    return kind === "PARENT" ? c.parentSessionDays * 86_400_000 : c.adminSessionHours * 3_600_000;
  }

  async create(kind: SessionKind, subjectId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const expiresAt = new Date(this.deps.clock.now().getTime() + this.ttlMs(kind));
    await this.deps.db.session.create({
      data: { id: hashToken(token), kind, expiresAt, ...(kind === "PARENT" ? { parentId: subjectId } : { adminId: subjectId }) }
    });
    return { token, expiresAt };
  }

  /** Returns the session's subject, or null. Parent sessions slide when less than half their life is left. */
  async resolve(token: string, kind: SessionKind): Promise<{ parent?: Parent; admin?: AdminUser; renewedUntil?: Date } | null> {
    const id = hashToken(token);
    const s = await this.deps.db.session.findUnique({ where: { id }, include: { parent: true, admin: true } });
    if (!s || s.kind !== kind) return null;
    const now = this.deps.clock.now();
    if (s.expiresAt <= now) {
      await this.deps.db.session.delete({ where: { id } }).catch(() => undefined);
      return null;
    }
    let renewedUntil: Date | undefined;
    if (kind === "PARENT" && s.expiresAt.getTime() - now.getTime() < this.ttlMs(kind) / 2) {
      renewedUntil = new Date(now.getTime() + this.ttlMs(kind));
      await this.deps.db.session.update({ where: { id }, data: { expiresAt: renewedUntil } });
    }
    return { parent: s.parent ?? undefined, admin: s.admin ?? undefined, renewedUntil };
  }

  async destroy(token: string) {
    await this.deps.db.session.deleteMany({ where: { id: hashToken(token) } });
  }

  async destroyAllForParent(parentId: string) {
    await this.deps.db.session.deleteMany({ where: { parentId } });
  }

  async purgeExpired() {
    await this.deps.db.session.deleteMany({ where: { expiresAt: { lte: this.deps.clock.now() } } });
  }
}
