import { Router } from "express";
import { z } from "zod";
import type { Container } from "../container";
import { requireParent } from "../http/session";
import { parse } from "../http/validate";

export function meRoutes(c: Container) {
  const r = Router();
  r.get("/me/bookings", requireParent, async (req, res) => {
    const { scope } = parse(z.object({ scope: z.enum(["upcoming", "past", "all"]).default("all") }), req.query);
    const now = c.clock.now();
    const rows = await c.db.booking.findMany({
      where: {
        parentId: req.auth!.parent!.id,
        ...(scope === "upcoming" ? { status: "CONFIRMED", startUtc: { gt: now } } : {}),
        ...(scope === "past" ? { OR: [{ status: "CANCELLED" }, { startUtc: { lte: now } }] } : {})
      },
      include: { mentor: true, parent: true },
      orderBy: { startUtc: scope === "upcoming" ? "asc" : "desc" }
    });
    res.json(rows.map(b => c.bookings.toDto(b)));
  });
  return r;
}
