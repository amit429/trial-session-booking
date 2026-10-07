import { Router } from "express";
import { z } from "zod";
import type { Container } from "../container";
import { notFound } from "../http/errors";
import { parse } from "../http/validate";
import { toOutboxDto } from "../services/adminService";

/** Development-only inbox so verify/reset/manage links can be clicked without real email (FR-20). */
export function devRoutes(c: Container) {
  const r = Router();
  r.get("/dev/outbox", async (req, res) => {
    if (!c.config.devOutboxEnabled) throw notFound();
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    const rows = await c.db.outboxMessage.findMany({ include: { booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, take: limit });
    res.json(rows.map(toOutboxDto));
  });
  return r;
}
