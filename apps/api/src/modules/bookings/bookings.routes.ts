import { Router } from "express";
import { CancelRequest, CreateBookingRequest } from "@shared";
import type { Request } from "express";
import { icsFile } from "@/modules/bookings/calendar";
import type { Viewer } from "@/modules/bookings/bookings.service";
import { z } from "zod";
import type { Container } from "@/container";
import { AppError } from "@/http/errors";
import { limiter } from "@/http/middleware/rate-limit";
import { parse } from "@/http/validate";

const IdempotencyKey = z.string().uuid();

export function bookingRoutes(c: Container) {
  const r = Router();

  r.post("/bookings", limiter(c.config.rateLimitEnabled, 10), async (req, res) => {
    const key = IdempotencyKey.safeParse(req.header("Idempotency-Key"));
    if (!key.success) throw new AppError("VALIDATION", 400, "Send a UUID in the Idempotency-Key header.");
    const body = parse(CreateBookingRequest, req.body);
    const sessionEmail = req.auth?.parent?.email;
    res.status(201).json(await c.bookings.create(body, key.data, sessionEmail));
  });

  const viewer = (req: Request, token?: unknown): Viewer => ({
    token: typeof token === "string" && token ? token : undefined,
    parentId: req.auth?.parent?.emailVerifiedAt ? req.auth.parent.id : undefined,
    isAdmin: !!req.auth?.admin
  });

  r.get("/bookings/:reference", async (req, res) => {
    const b = await c.bookings.getForViewer(req.params.reference, viewer(req, req.query.token));
    res.json(c.bookings.toDto(b));
  });

  r.post("/bookings/:reference/cancel", async (req, res) => {
    const { token } = parse(CancelRequest, req.body ?? {});
    const v = viewer(req, token);
    const by = v.isAdmin && !v.token ? "ADMIN" : "PARENT";
    res.json(c.bookings.toDto(await c.bookings.cancel(req.params.reference, v, by)));
  });

  r.get("/bookings/:reference/calendar.ics", async (req, res) => {
    const b = await c.bookings.getForViewer(req.params.reference, viewer(req, req.query.token));
    res
      .type("text/calendar; charset=utf-8")
      .attachment(`trial-${b.reference}.ics`)
      .send(icsFile({ ...b, mentorName: b.mentor.name, cancelled: b.status === "CANCELLED" }, c.clock.now()));
  });

  return r;
}
