import type { RequestHandler } from "express";
import type { Container } from "../container";
import { ADMIN_COOKIE, PARENT_COOKIE, setSessionCookie } from "./cookies";
import { AppError } from "./errors";

/** Attach req.auth from the parent and admin cookies (separate on purpose, ADR-15). */
export function loadSession(c: Container): RequestHandler {
  return async (req, res, next) => {
    req.auth = {};
    const p = req.cookies?.[PARENT_COOKIE];
    if (p) {
      const s = await c.sessions.resolve(p, "PARENT");
      if (s?.parent) {
        req.auth.parent = s.parent;
        if (s.renewedUntil) setSessionCookie(res, c.config, PARENT_COOKIE, p, s.renewedUntil);
      }
    }
    const a = req.cookies?.[ADMIN_COOKIE];
    if (a) {
      const s = await c.sessions.resolve(a, "ADMIN");
      if (s?.admin) req.auth.admin = s.admin;
    }
    next();
  };
}

export const requireParent: RequestHandler = (req, _res, next) => {
  const p = req.auth?.parent;
  if (!p) throw new AppError("UNAUTHENTICATED", 401);
  if (!p.emailVerifiedAt) throw new AppError("EMAIL_NOT_VERIFIED", 403);
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth?.admin) throw new AppError("UNAUTHENTICATED", 401);
  next();
};
