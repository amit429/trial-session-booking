import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "@/http/errors";

/** Per-minute limiter. Keyed by IP (IPv6 grouped by /56 subnet so rotating addresses doesn't bypass it), plus the submitted email for auth forms. */
export function limiter(enabled: boolean, limit: number, withEmail = false): RequestHandler {
  if (!enabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const email = withEmail && typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      return `${ipKeyGenerator(req.ip ?? "")}|${email}`;
    },
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED", 429))
  });
}
