import type { AuthTokenPurpose } from "@prisma/client";
import type { Db } from "@/core/db";

/** Single-use verification and reset tokens. Only SHA-256 hashes are stored. */
export class AuthTokensRepository {
  constructor(private db: Db) {}

  /** Mark every unused token of this purpose as used, so only the newest link works. */
  retireUnused(parentId: string, purpose: AuthTokenPurpose, at: Date) {
    return this.db.authToken.updateMany({ where: { parentId, purpose, usedAt: null }, data: { usedAt: at } });
  }

  create(parentId: string, purpose: AuthTokenPurpose, tokenHash: string, expiresAt: Date) {
    return this.db.authToken.create({ data: { parentId, purpose, tokenHash, expiresAt } });
  }

  findByHash(tokenHash: string) {
    return this.db.authToken.findUnique({ where: { tokenHash } });
  }

  /** Atomically claim an unused token; false if someone else used it first. */
  async claim(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.authToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } });
    return count === 1;
  }
}
