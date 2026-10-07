import { Router } from "express";
import type { Container } from "../container";
import { requireAdmin } from "../http/session";

/** Every /admin/* endpoint requires an admin session; parents' cookies never qualify. */
export function adminRoutes(_c: Container) {
  const r = Router();
  r.use("/admin", requireAdmin);
  return r;
}
