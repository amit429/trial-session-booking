import type { Request, Response } from "express";
import { z } from "zod";
import type { Container } from "@/container";
import { parse } from "@/http/validate";

const paging = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const DaysQuery = z.object({ days: z.coerce.number().int().min(1).max(31).default(14) });
const BookingsQuery = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("all"),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  mentorId: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
  ...paging
});
const SearchQuery = z.object({ q: z.string().max(100).optional(), ...paging });
const IdParams = z.object({ id: z.string().uuid() });
const ScheduleQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(14)
});

export const adminController = (c: Container) => ({
  async dashboard(req: Request, res: Response) {
    res.json(await c.admin.dashboard(parse(DaysQuery, req.query).days));
  },
  async bookings(req: Request, res: Response) {
    res.json(await c.admin.listBookings(parse(BookingsQuery, req.query)));
  },
  async booking(req: Request<{ reference: string }>, res: Response) {
    res.json(await c.admin.bookingDetail(req.params.reference));
  },
  async cancelBooking(req: Request<{ reference: string }>, res: Response) {
    res.json(await c.admin.cancel(req.params.reference));
  },
  async parents(req: Request, res: Response) {
    const q = parse(SearchQuery, req.query);
    res.json(await c.admin.listParents(q.q, q.page, q.pageSize));
  },
  async parent(req: Request, res: Response) {
    res.json(await c.admin.parentDetail(parse(IdParams, req.params).id));
  },
  async mentors(_req: Request, res: Response) {
    res.json(await c.admin.listMentors());
  },
  async mentorSchedule(req: Request, res: Response) {
    const { id } = parse(IdParams, req.params);
    const q = parse(ScheduleQuery, req.query);
    res.json(await c.admin.mentorSchedule(id, q.from, q.days));
  },
  async outbox(req: Request, res: Response) {
    const q = parse(z.object(paging), req.query);
    res.json(await c.outbox.page(q.page, q.pageSize));
  }
});
