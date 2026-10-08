import type { Request, Response } from "express";
import { z } from "zod";
import type { Container } from "@/container";
import { notFound } from "@/http/errors";
import { parse } from "@/http/validate";

export const devController = (c: Container) => ({
  /** Development-only inbox so verify/reset/manage links can be clicked without real email (FR-20). */
  async outbox(req: Request, res: Response) {
    if (!c.config.devOutboxEnabled) throw notFound();
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    res.json(await c.outbox.recent(limit));
  }
});
