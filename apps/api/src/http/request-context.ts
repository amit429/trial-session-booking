import type { AdminUser, Parent } from "@prisma/client";
import type { Request } from "express";
import { AppError } from "./errors";

/** The signed-in, verified parent for this request (routes are already behind requireParent). */
export function currentParent(req: Request): Parent {
  const parent = req.auth?.parent;
  if (!parent) throw new AppError("UNAUTHENTICATED", 401);
  return parent;
}

/** The signed-in admin for this request (routes are already behind requireAdmin). */
export function currentAdmin(req: Request): AdminUser {
  const admin = req.auth?.admin;
  if (!admin) throw new AppError("UNAUTHENTICATED", 401);
  return admin;
}
