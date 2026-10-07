import { createDb, type Db } from "../../src/db";

export const testDb: Db = createDb(process.env.TEST_DATABASE_URL);

export async function resetDb(db: Db = testDb) {
  await db.$executeRawUnsafe(
    'TRUNCATE "OutboxMessage", "Booking", "AuthToken", "Session", "AdminUser", "Parent", "AvailabilityRule", "Mentor" RESTART IDENTITY CASCADE'
  );
}
