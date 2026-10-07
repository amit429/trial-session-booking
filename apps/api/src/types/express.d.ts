import type { AdminUser, Parent } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: { parent?: Parent; admin?: AdminUser };
    }
  }
}
export {};
