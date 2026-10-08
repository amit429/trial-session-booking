import type { Prisma } from "@prisma/client";
import type { Db } from "@/core/db";

export class ParentsRepository {
  constructor(private db: Db) {}

  findByEmail(email: string) {
    return this.db.parent.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.db.parent.findUnique({ where: { id } });
  }

  /** Create or update the account for a sign-up. The account stays pending until the email is verified. */
  upsertPendingAccount(email: string, name: string, passwordHash: string) {
    return this.db.parent.upsert({
      where: { email },
      create: { name, email, timezone: "UTC", passwordHash },
      update: { name, passwordHash, emailVerifiedAt: null }
    });
  }

  markVerified(id: string, at: Date) {
    return this.db.parent.update({ where: { id }, data: { emailVerifiedAt: at } });
  }

  setPassword(id: string, passwordHash: string, verifiedAt: Date) {
    return this.db.parent.update({ where: { id }, data: { passwordHash, emailVerifiedAt: verifiedAt } });
  }

  search(where: Prisma.ParentWhereInput, page: number, pageSize: number) {
    return Promise.all([
      this.db.parent.findMany({
        where,
        include: { bookings: { select: { status: true, startUtc: true } } },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.parent.count({ where })
    ]);
  }

  findWithBookings(id: string) {
    return this.db.parent.findUnique({
      where: { id },
      include: { bookings: { include: { mentor: true, parent: true }, orderBy: { startUtc: "desc" } } }
    });
  }
}
