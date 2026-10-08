import { SignupRequest } from "@shared";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { firstFieldError, useSignup } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";

const linkClass = "font-medium text-foreground underline underline-offset-4";

export function SignupPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: params.get("email") ?? "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = SignupRequest.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    signup.mutate(parsed.data, { onError: e2 => setError(firstFieldError(e2)) });
  };

  if (signup.isSuccess) {
    return (
      <AuthCard icon={<Mail />} title="Check your email" description={`If ${form.email.trim()} can be used, we've sent a link to verify it. The link works for 24 hours.`}
        footer={<>Wrong email? <button className={`cursor-pointer ${linkClass}`} onClick={() => signup.reset()}>Start again</button></>}>
        <Button asChild variant="outline" className="w-full"><Link to="/dev/outbox">Open dev outbox</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Create an account" description="See every trial you've booked. Use the email you booked with." footer={<>Already have an account? <Link className={linkClass} to="/login">Sign in</Link></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
        {error && <Alert variant="destructive" title={error} />}
        <Field id="su-name" label="Name"><Input id="su-name" autoComplete="name" placeholder="Jane Doe" value={form.name} onChange={set("name")} /></Field>
        <Field id="su-email" label="Email"><Input id="su-email" type="email" autoComplete="email" placeholder="jane@example.com" value={form.email} onChange={set("email")} /></Field>
        <Field id="su-pw" label="Password" description="At least 8 characters."><Input id="su-pw" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
        <Button type="submit" className="w-full" disabled={signup.isPending}>{signup.isPending ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}
