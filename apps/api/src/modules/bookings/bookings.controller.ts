import { CancelRequest, CreateBookingRequest } from "@shared";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Container } from "@/container";
import { AppError } from "@/http/errors";
import { parse } from "@/http/validate";
import type { Viewer } from "./booking-access";
import { icsFile } from "./calendar";

const IdempotencyKey = z.string().uuid();

/** Who's asking: the private-link token if given, the verified parent session, or an admin session. */
const viewerFrom = (req: Request, token?: unknown): Viewer => ({
  token: typeof token === "string" && token ? token : undefined,
  parentId: req.auth?.parent?.emailVerifiedAt ? req.auth.parent.id : undefined,
  isAdmin: !!req.auth?.admin
});

export const bookingsController = (c: Container) => ({
  async create(req: Request, res: Response) {
    const key = IdempotencyKey.safeParse(req.header("Idempotency-Key"));
    if (!key.success) throw new AppError("VALIDATION", 400, "Send a UUID in the Idempotency-Key header.");
    const body = parse(CreateBookingRequest, req.body);
    res.status(201).json(await c.bookings.create(body, key.data, req.auth?.parent?.email));
  },

  async get(req: Request<{ reference: string }>, res: Response) {
    res.json(c.bookings.toDto(await c.bookings.getForViewer(req.params.reference, viewerFrom(req, req.query.token))));
  },

  async cancel(req: Request<{ reference: string }>, res: Response) {
    const { token } = parse(CancelRequest, req.body ?? {});
    const viewer = viewerFrom(req, token);
    const by = viewer.isAdmin && !viewer.token ? "ADMIN" : "PARENT";
    res.json(c.bookings.toDto(await c.bookings.cancel(req.params.reference, viewer, by)));
  },

  async calendar(req: Request<{ reference: string }>, res: Response) {
    const b = await c.bookings.getForViewer(req.params.reference, viewerFrom(req, req.query.token));
    res
      .type("text/calendar; charset=utf-8")
      .attachment(`trial-${b.reference}.ics`)
      .send(icsFile({ ...b, mentorName: b.mentor.name, cancelled: b.status === "CANCELLED" }, c.clock.now()));
  }
});
