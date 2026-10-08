import { Router } from "express";
import type { Container } from "@/container";
import { requireAdmin } from "@/http/middleware/session";
import { adminController } from "./admin.controller";

/** Every /admin/* endpoint requires an admin session; parents' cookies never qualify. */
export function adminRoutes(c: Container) {
  const ctrl = adminController(c);
  return Router()
    .use("/admin", requireAdmin)
    .get("/admin/dashboard", ctrl.dashboard)
    .get("/admin/bookings", ctrl.bookings)
    .get("/admin/bookings/:reference", ctrl.booking)
    .post("/admin/bookings/:reference/cancel", ctrl.cancelBooking)
    .get("/admin/parents", ctrl.parents)
    .get("/admin/parents/:id", ctrl.parent)
    .get("/admin/mentors", ctrl.mentors)
    .get("/admin/mentors/:id/schedule", ctrl.mentorSchedule)
    .get("/admin/outbox", ctrl.outbox);
}
