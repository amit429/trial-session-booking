import { Router } from "express";
import type { Container } from "@/container";

export function healthRoutes(c: Container) {
  const r = Router();
  r.get("/health", async (_req, res) => {
    try {
      await c.db.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "degraded", db: "unreachable" });
    }
  });
  return r;
}
