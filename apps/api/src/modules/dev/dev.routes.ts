import { Router } from "express";
import type { Container } from "@/container";
import { devController } from "./dev.controller";

export function devRoutes(c: Container) {
  return Router().get("/dev/outbox", devController(c).outbox);
}
