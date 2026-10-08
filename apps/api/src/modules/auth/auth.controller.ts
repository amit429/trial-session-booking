import {
  EmailRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupRequest,
  TokenRequest,
  type AdminLoginResponse,
  type MeResponse,
  type MessageResponse,
  type ParentLoginResponse
} from "@shared";
import type { Request, Response } from "express";
import type { Container } from "@/container";
import { ADMIN_COOKIE, PARENT_COOKIE, clearSessionCookie, setSessionCookie } from "@/http/cookies";
import { parse } from "@/http/validate";
import { toAdminDto, toParentDto } from "./auth.mapper";

const CHECK_EMAIL: MessageResponse = { message: "Check your email." };

export const authController = (c: Container) => {
  /** Sign-in rotates the session: any session already on this cookie is ended first. */
  const endExisting = async (req: Request, cookie: string) => {
    const old = req.cookies?.[cookie];
    if (old) await c.sessions.destroy(old);
  };
  const logout = (cookie: string) => async (req: Request, res: Response) => {
    const token = req.cookies?.[cookie];
    if (token) await c.sessions.destroy(token);
    clearSessionCookie(res, c.config, cookie);
    res.status(204).end();
  };

  return {
    me(req: Request, res: Response<MeResponse>) {
      const { parent, admin } = req.auth ?? {};
      res.json({ parent: parent ? toParentDto(parent) : null, admin: admin ? toAdminDto(admin) : null });
    },

    async signup(req: Request, res: Response<MessageResponse>) {
      const { name, email, password } = parse(SignupRequest, req.body);
      await c.parentAuth.signup(name, email, password);
      res.status(202).json(CHECK_EMAIL);
    },

    async resendVerification(req: Request, res: Response<MessageResponse>) {
      await c.parentAuth.resendVerification(parse(EmailRequest, req.body).email);
      res.status(202).json(CHECK_EMAIL);
    },

    async verify(req: Request, res: Response<MessageResponse>) {
      await c.parentAuth.verify(parse(TokenRequest, req.body).token);
      res.json({ message: "Email verified." });
    },

    async parentLogin(req: Request, res: Response<ParentLoginResponse>) {
      const { email, password } = parse(LoginRequest, req.body);
      await endExisting(req, PARENT_COOKIE);
      const { parent, token, expiresAt } = await c.parentAuth.login(email, password);
      setSessionCookie(res, c.config, PARENT_COOKIE, token, expiresAt);
      res.json({ parent: toParentDto(parent) });
    },

    async forgotPassword(req: Request, res: Response<MessageResponse>) {
      await c.parentAuth.forgotPassword(parse(EmailRequest, req.body).email);
      res.status(202).json(CHECK_EMAIL);
    },

    async resetPassword(req: Request, res: Response<MessageResponse>) {
      const { token, password } = parse(ResetPasswordRequest, req.body);
      await c.parentAuth.resetPassword(token, password);
      clearSessionCookie(res, c.config, PARENT_COOKIE);
      res.json({ message: "Password updated." });
    },

    parentLogout: logout(PARENT_COOKIE),

    async adminLogin(req: Request, res: Response<AdminLoginResponse>) {
      const { email, password } = parse(LoginRequest, req.body);
      await endExisting(req, ADMIN_COOKIE);
      const { admin, token, expiresAt } = await c.adminAuth.login(email, password);
      setSessionCookie(res, c.config, ADMIN_COOKIE, token, expiresAt);
      res.json({ admin: toAdminDto(admin) });
    },

    adminLogout: logout(ADMIN_COOKIE)
  };
};
