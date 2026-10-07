import { Router } from "express";
import { CreateBookingRequest } from "@trial/shared";
import { z } from "zod";
import type { Container } from "../container";
import { AppError } from "../http/errors";
import { limiter } from "../http/rateLimit";
import { parse } from "../http/validate";

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

  return r;
}
