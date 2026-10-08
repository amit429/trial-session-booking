import type { SessionKind } from "@prisma/client";
import type { Db } from "@/core/db";

export class SessionsRepository {
  constructor(private db: Db) {}

  create(id: string, kind: SessionKind, subjectId: string, expiresAt: Date) {
    return this.db.session.create({ data: { id, kind, expiresAt, ...(kind === "PARENT" ? { parentId: subjectId } : { adminId: subjectId }) } });
  }

  findWithSubject(id: string) {
    return this.db.session.findUnique({ where: { id }, include: { parent: true, admin: true } });
  }

  extend(id: string, expiresAt: Date) {
    return this.db.session.update({ where: { id }, data: { expiresAt } });
  }

  delete(id: string) {
    return this.db.session.deleteMany({ where: { id } });
  }

  deleteForParent(parentId: string) {
    return this.db.session.deleteMany({ where: { parentId } });
  }

  deleteExpired(now: Date) {
    return this.db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  }
}
