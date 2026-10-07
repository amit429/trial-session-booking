import { Router } from "express";
import { EmailRequest, LoginRequest, ResetPasswordRequest, SignupRequest, TokenRequest, type MeResponse } from "@trial/shared";
import type { Container } from "../container";
import { ADMIN_COOKIE, PARENT_COOKIE, clearSessionCookie, setSessionCookie } from "../http/cookies";
import { limiter } from "../http/rateLimit";
import { parse } from "../http/validate";
import { toParentDto } from "../services/parentAuthService";

const CHECK_EMAIL = { message: "Check your email." };

export function authRoutes(c: Container) {
  const r = Router();
  const authLimit = limiter(c.config.rateLimitEnabled, 5, true);

  r.get("/auth/me", (req, res) => {
    const { parent, admin } = req.auth ?? {};
    const body: MeResponse = {
      parent: parent ? toParentDto(parent) : null,
      admin: admin ? { id: admin.id, name: admin.name, email: admin.email } : null
    };
    res.json(body);
  });

  r.post("/auth/parent/signup", authLimit, async (req, res) => {
    const { name, email, password } = parse(SignupRequest, req.body);
    await c.parentAuth.signup(name, email, password);
    res.status(202).json(CHECK_EMAIL);
  });

  r.post("/auth/parent/resend-verification", authLimit, async (req, res) => {
    await c.parentAuth.resendVerification(parse(EmailRequest, req.body).email);
    res.status(202).json(CHECK_EMAIL);
  });

  r.post("/auth/parent/verify", async (req, res) => {
    await c.parentAuth.verify(parse(TokenRequest, req.body).token);
    res.json({ message: "Email verified." });
  });

  r.post("/auth/parent/login", authLimit, async (req, res) => {
    const { email, password } = parse(LoginRequest, req.body);
    const old = req.cookies?.[PARENT_COOKIE];
    if (old) await c.sessions.destroy(old);
    const { parent, token, expiresAt } = await c.parentAuth.login(email, password);
    setSessionCookie(res, c.config, PARENT_COOKIE, token, expiresAt);
    res.json({ parent: toParentDto(parent) });
  });

  r.post("/auth/parent/forgot-password", authLimit, async (req, res) => {
    await c.parentAuth.forgotPassword(parse(EmailRequest, req.body).email);
    res.status(202).json(CHECK_EMAIL);
  });

  r.post("/auth/parent/reset-password", async (req, res) => {
    const { token, password } = parse(ResetPasswordRequest, req.body);
    await c.parentAuth.resetPassword(token, password);
    clearSessionCookie(res, c.config, PARENT_COOKIE);
    res.json({ message: "Password updated." });
  });

  r.post("/auth/parent/logout", async (req, res) => {
    const token = req.cookies?.[PARENT_COOKIE];
    if (token) await c.sessions.destroy(token);
    clearSessionCookie(res, c.config, PARENT_COOKIE);
    res.status(204).end();
  });

  r.post("/auth/admin/login", authLimit, async (req, res) => {
    const { email, password } = parse(LoginRequest, req.body);
    const old = req.cookies?.[ADMIN_COOKIE];
    if (old) await c.sessions.destroy(old);
    const { admin, token, expiresAt } = await c.adminAuth.login(email, password);
    setSessionCookie(res, c.config, ADMIN_COOKIE, token, expiresAt);
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  });

  r.post("/auth/admin/logout", async (req, res) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (token) await c.sessions.destroy(token);
    clearSessionCookie(res, c.config, ADMIN_COOKIE);
    res.status(204).end();
  });

  return r;
}
