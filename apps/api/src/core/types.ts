import type { Prisma } from "@prisma/client";
import type { Db } from "./db";

/** Either the client or an open transaction: repositories accept both. */
export type DbClient = Db | Prisma.TransactionClient;
