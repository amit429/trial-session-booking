import { z } from "zod";
import { emailField, passwordField, tokenField } from "./fields";

export const SignupRequest = z
  .object({ name: z.string().trim().min(2, "Please enter your name").max(80), email: emailField, password: passwordField })
  .refine(v => v.password.toLowerCase() !== v.email, { message: "Password can't be your email", path: ["password"] });
export type SignupRequest = z.infer<typeof SignupRequest>;

export const LoginRequest = z.object({ email: emailField, password: z.string().min(1, "Please enter your password") });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const EmailRequest = z.object({ email: emailField });
export const TokenRequest = z.object({ token: tokenField });
export const ResetPasswordRequest = z.object({ token: tokenField, password: passwordField });
