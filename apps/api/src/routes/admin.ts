import { Router } from "express";
import { z } from "zod";
import type { Container } from "../container";
import { requireAdmin } from "../http/session";
import { parse } from "../http/validate";

const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Every /admin/* endpoint requires an admin session; parents' cookies never qualify. */
export function adminRoutes(c: Container) {
  const r = Router();
  r.use("/admin", requireAdmin);

  r.get("/admin/dashboard", async (req, res) => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(31).default(14) }), req.query);
    res.json(await c.admin.dashboard(days));
  });

  r.get("/admin/bookings", async (req, res) => {
    const f = parse(z.object({
      scope: z.enum(["upcoming", "past", "all"]).default("all"),
      status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
      mentorId: z.string().uuid().optional(),
      q: z.string().max(100).optional(),
      ...page
    }), req.query);
    res.json(await c.admin.listBookings(f));
  });
  r.get("/admin/bookings/:reference", async (req, res) => res.json(await c.admin.bookingDetail(req.params.reference)));
  r.post("/admin/bookings/:reference/cancel", async (req, res) => res.json(await c.admin.cancel(req.params.reference)));

  r.get("/admin/parents", async (req, res) => {
    const q = parse(z.object({ q: z.string().max(100).optional(), ...page }), req.query);
    res.json(await c.admin.listParents(q.q, q.page, q.pageSize));
  });
  r.get("/admin/parents/:id", async (req, res) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    res.json(await c.admin.parentDetail(id));
  });

  r.get("/admin/mentors", async (_req, res) => res.json(await c.admin.listMentors()));
  r.get("/admin/mentors/:id/schedule", async (req, res) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const q = parse(z.object({ from: isoDate.optional(), days: z.coerce.number().int().min(1).max(31).default(14) }), req.query);
    res.json(await c.admin.mentorSchedule(id, q.from, q.days));
  });

  r.get("/admin/outbox", async (req, res) => {
    const q = parse(z.object(page), req.query);
    res.json(await c.admin.outbox(q.page, q.pageSize));
  });

  return r;
}
