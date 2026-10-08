import { Router } from "express";
import type { Container } from "@/container";
import { limiter } from "@/http/middleware/rate-limit";
import { authController } from "./auth.controller";

export function authRoutes(c: Container) {
  const ctrl = authController(c);
  const throttle = limiter(c.config.rateLimitEnabled, 5, true);
  return Router()
    .get("/auth/me", ctrl.me)
    .post("/auth/parent/signup", throttle, ctrl.signup)
    .post("/auth/parent/resend-verification", throttle, ctrl.resendVerification)
    .post("/auth/parent/verify", ctrl.verify)
    .post("/auth/parent/login", throttle, ctrl.parentLogin)
    .post("/auth/parent/forgot-password", throttle, ctrl.forgotPassword)
    .post("/auth/parent/reset-password", ctrl.resetPassword)
    .post("/auth/parent/logout", ctrl.parentLogout)
    .post("/auth/admin/login", throttle, ctrl.adminLogin)
    .post("/auth/admin/logout", ctrl.adminLogout);
}
