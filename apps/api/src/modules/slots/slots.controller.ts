import { SlotsQuery, SuggestionsQuery } from "@shared";
import type { Request, Response } from "express";
import type { Container } from "@/container";
import { parse } from "@/http/validate";

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export const slotsController = (c: Container) => ({
  async list(req: Request, res: Response) {
    const q = parse(SlotsQuery, req.query);
    res.json(await c.slots.slotsResponse(q.tz, q.from, q.days));
  },

  async suggestions(req: Request, res: Response) {
    const q = parse(SuggestionsQuery, req.query);
    res.json(await c.suggestions.suggest(q.tz, q.date, toMinutes(q.time)));
  }
});
