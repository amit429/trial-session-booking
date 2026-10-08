import type { Db } from "@/core/db";

export class AdminsRepository {
  constructor(private db: Db) {}

  findByEmail(email: string) {
    return this.db.adminUser.findUnique({ where: { email } });
  }

  upsert(email: string, name: string, passwordHash: string) {
    return this.db.adminUser.upsert({ where: { email }, create: { email, name, passwordHash }, update: { name, passwordHash } });
  }
}
