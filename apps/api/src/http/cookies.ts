import type { CookieOptions, Response } from "express";
import type { Config } from "../config";

export const PARENT_COOKIE = "cy_parent_sid";
export const ADMIN_COOKIE = "cy_admin_sid";

const base = (config: Config): CookieOptions => ({ httpOnly: true, sameSite: "lax", secure: config.env === "production", path: "/" });

export function setSessionCookie(res: Response, config: Config, name: string, value: string, expires: Date) {
  res.cookie(name, value, { ...base(config), expires });
}
export function clearSessionCookie(res: Response, config: Config, name: string) {
  res.clearCookie(name, base(config));
}
