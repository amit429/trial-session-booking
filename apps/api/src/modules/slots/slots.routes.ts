import { Router } from "express";
import type { Container } from "@/container";
import { slotsController } from "./slots.controller";

export function slotRoutes(c: Container) {
  const ctrl = slotsController(c);
  return Router().get("/slots", ctrl.list).get("/slots/suggestions", ctrl.suggestions);
}
