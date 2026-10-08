import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { AuthCard } from "../components/AuthCard";

const back = <Link className="font-medium text-foreground underline underline-offset-4" to="/login">Back to sign in</Link>;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const m = useMutation({ mutationFn: () => api.post("/auth/parent/forgot-password", { email: email.trim() }) });
  if (m.isSuccess) {
    return (
      <AuthCard icon={<Mail />} title="Check your email" description="If an account exists for that email, we've sent a reset link. It works for 1 hour." footer={back}>
        <Button asChild variant="outline" className="w-full"><Link to="/dev/outbox">Open dev outbox</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password" description="Enter your email and we'll send you a link to set a new password." footer={back}>
      <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); m.mutate(); }}>
        {m.isError && <Alert variant="destructive" title={m.error instanceof ApiError ? m.error.message : "Something went wrong"} />}
        <Field id="fp-email" label="Email"><Input id="fp-email" type="email" autoComplete="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={m.isPending}>Send reset link</Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.post("/auth/parent/reset-password", { token: params.get("token") ?? "", password }),
    onSuccess: () => { toast.success("Password updated", { description: "Sign in with your new password." }); navigate("/login"); },
    onError: e => setError(e instanceof ApiError ? (e.code === "TOKEN_INVALID" ? "expired" : Object.values((e.details?.fieldErrors ?? {}) as Record<string, string>)[0] ?? e.message) : "Something went wrong.")
  });
  if (error === "expired") {
    return (
      <AuthCard icon={<AlertTriangle />} title="This link has expired" description="Reset links work once and for 1 hour.">
        <Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Set a new password" description="You'll be signed out everywhere else.">
      <form className="flex flex-col gap-4" noValidate onSubmit={e => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters");
        setError(null);
        m.mutate();
      }}>
        {error && <Alert variant="destructive" title={error} />}
        <Field id="rp-pw" label="New password" description="At least 8 characters."><Input id="rp-pw" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={m.isPending}>Save password</Button>
      </form>
    </AuthCard>
  );
}
