import type { BookingDto } from "@shared";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Container } from "@/container";
import { currentParent } from "@/http/request-context";
import { parse } from "@/http/validate";

const BookingsQuery = z.object({ scope: z.enum(["upcoming", "past", "all"]).default("all") });

export const meController = (c: Container) => ({
  async bookings(req: Request, res: Response<BookingDto[]>) {
    const { scope } = parse(BookingsQuery, req.query);
    res.json(await c.bookings.listForParent(currentParent(req).id, scope));
  }
});
