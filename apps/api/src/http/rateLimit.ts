import type { Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "./errors";

/** Per-minute limiter. Keyed by IP, plus the submitted email when present (auth forms). */
export function limiter(enabled: boolean, limit: number, withEmail = false): RequestHandler {
  if (!enabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const email = withEmail && typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      return `${req.ip}|${email}`;
    },
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED", 429))
  });
}
