import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginRequest, MessageResponse, ParentLoginResponse, SignupRequest } from "@shared";
import { api, isApiError } from "@/lib/api-client";
import { setSession } from "@/lib/session";

/** Sign in and record the session before navigating, so route guards see it at once. */
export const useParentLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api.post<ParentLoginResponse>("/auth/parent/login", body),
    onSuccess: r => setSession(qc, { parent: r.parent })
  });
};

export const useSignup = () => useMutation({ mutationFn: (body: SignupRequest) => api.post<MessageResponse>("/auth/parent/signup", body) });
export const useVerifyEmail = () => useMutation({ mutationFn: (token: string) => api.post<MessageResponse>("/auth/parent/verify", { token }) });
export const useResendVerification = () => useMutation({ mutationFn: (email: string) => api.post<MessageResponse>("/auth/parent/resend-verification", { email }) });
export const useForgotPassword = () => useMutation({ mutationFn: (email: string) => api.post<MessageResponse>("/auth/parent/forgot-password", { email }) });
export const useResetPassword = () =>
  useMutation({ mutationFn: (body: { token: string; password: string }) => api.post<MessageResponse>("/auth/parent/reset-password", body) });

/** First field error from a VALIDATION response, else the error's own message. */
export const firstFieldError = (e: unknown) => {
  if (!isApiError(e)) return "Something went wrong. Please try again.";
  return Object.values(e.details.fieldErrors ?? {})[0] ?? e.message;
};
