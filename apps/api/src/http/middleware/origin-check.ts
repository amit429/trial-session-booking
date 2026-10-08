import type { RequestHandler } from "express";
import { ADMIN_COOKIE, PARENT_COOKIE } from "@/http/cookies";
import { AppError } from "@/http/errors";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** CSRF guard: a state-changing request that carries a session cookie must come from our own origin. */
export function originCheck(appBaseUrl: string): RequestHandler {
  const allowed = new URL(appBaseUrl).origin;
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next();
    if (!req.cookies?.[PARENT_COOKIE] && !req.cookies?.[ADMIN_COOKIE]) return next();
    const source = req.get("origin") ?? (req.get("referer") ? new URL(req.get("referer")!).origin : undefined);
    if (source && source !== allowed) throw new AppError("ORIGIN_MISMATCH", 403);
    next();
  };
}
