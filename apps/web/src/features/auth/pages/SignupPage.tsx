import { useMutation } from "@tanstack/react-query";
import { SignupRequest } from "@shared";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { AuthCard } from "../components/AuthCard";

export function SignupPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: params.get("email") ?? "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (body: unknown) => api.post("/auth/parent/signup", body),
    onError: e => setError(e instanceof ApiError ? Object.values((e.details?.fieldErrors ?? {}) as Record<string, string>)[0] ?? e.message : "Something went wrong. Please try again.")
  });

  if (m.isSuccess) {
    return (
      <AuthCard icon={<Mail />} title="Check your email" description={`If ${form.email.trim()} can be used, we've sent a link to verify it. The link works for 24 hours.`}
        footer={<>Wrong email? <button className="cursor-pointer font-medium text-foreground underline underline-offset-4" onClick={() => m.reset()}>Start again</button></>}>
        <Button asChild variant="outline" className="w-full"><Link to="/dev/outbox">Open dev outbox</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Create an account" description="See every trial you've booked. Use the email you booked with."
      footer={<>Already have an account? <Link className="font-medium text-foreground underline underline-offset-4" to="/login">Sign in</Link></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={e => {
        e.preventDefault();
        const r = SignupRequest.safeParse(form);
        if (!r.success) return setError(r.error.issues[0].message);
        setError(null);
        m.mutate(r.data);
      }}>
        {error && <Alert variant="destructive" title={error} />}
        <Field id="su-name" label="Name"><Input id="su-name" autoComplete="name" placeholder="Jane Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field id="su-email" label="Email"><Input id="su-email" type="email" autoComplete="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field id="su-pw" label="Password" description="At least 8 characters."><Input id="su-pw" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
        <Button type="submit" className="w-full" disabled={m.isPending}>{m.isPending ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}
