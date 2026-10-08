import { Router } from "express";
import type { Container } from "@/container";
import { requireParent } from "@/http/middleware/session";
import { meController } from "./me.controller";

export function meRoutes(c: Container) {
  return Router().get("/me/bookings", requireParent, meController(c).bookings);
}
