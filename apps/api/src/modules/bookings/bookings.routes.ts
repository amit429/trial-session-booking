import { Router } from "express";
import type { Container } from "@/container";
import { limiter } from "@/http/middleware/rate-limit";
import { bookingsController } from "./bookings.controller";

export function bookingRoutes(c: Container) {
  const ctrl = bookingsController(c);
  return Router()
    .post("/bookings", limiter(c.config.rateLimitEnabled, 10), ctrl.create)
    .get("/bookings/:reference", ctrl.get)
    .post("/bookings/:reference/cancel", ctrl.cancel)
    .get("/bookings/:reference/calendar.ics", ctrl.calendar);
}
