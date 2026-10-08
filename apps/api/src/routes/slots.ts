import { Router } from "express";
import { SlotsQuery, SuggestionsQuery } from "@shared";
import type { Container } from "../container";
import { parse } from "../http/validate";

export function slotRoutes(c: Container) {
  const r = Router();
  r.get("/slots", async (req, res) => {
    const q = parse(SlotsQuery, req.query);
    res.json(await c.slots.slotsResponse(q.tz, q.from, q.days));
  });
  r.get("/slots/suggestions", async (req, res) => {
    const q = parse(SuggestionsQuery, req.query);
    const minutes = Number(q.time.slice(0, 2)) * 60 + Number(q.time.slice(3));
    res.json(await c.suggestions.suggest(q.tz, q.date, minutes));
  });
  return r;
}
