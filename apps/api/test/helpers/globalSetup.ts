import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Give every test run a clean, fully migrated test database.
 * Guarded: only ever touches TEST_DATABASE_URL, and only a database whose name ends in "_test".
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/_test(\?|$)/.test(new URL(url).pathname + new URL(url).search)) {
    throw new Error(`Refusing to prepare a database that isn't a *_test database: ${url}`);
  }
  const db = new PrismaClient({ datasourceUrl: url });
  await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await db.$executeRawUnsafe("CREATE SCHEMA public");
  await db.$disconnect();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
