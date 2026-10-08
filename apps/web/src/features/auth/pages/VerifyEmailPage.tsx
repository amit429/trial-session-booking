import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { AuthCard } from "../components/AuthCard";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const started = useRef(false);
  const verify = useMutation({ mutationFn: () => api.post("/auth/parent/verify", { token }) });
  const resend = useMutation({ mutationFn: (email: string) => api.post("/auth/parent/resend-verification", { email }), onSuccess: () => toast.success("Check your email", { description: "If that account is waiting for verification, we've sent a new link." }) });
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Links are single-use: guard against React StrictMode running the effect twice.
    if (started.current) return;
    started.current = true;
    if (token) verify.mutate();
  }, [token, verify]);

  if (verify.isSuccess) {
    return (
      <AuthCard icon={<CheckCircle2 />} title="Email verified" description="Sign in to see every booking made with this email.">
        <Button asChild className="w-full"><Link to="/login">Sign in</Link></Button>
      </AuthCard>
    );
  }
  if (verify.isPending) return <AuthCard title="Verifying your email…"><Skeleton className="h-9" /></AuthCard>;
  return (
    <AuthCard icon={<AlertTriangle />} title="This link has expired" description="Verification links work once and for 24 hours. We can send you a new one.">
      <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); resend.mutate(email.trim()); }}>
        <Field id="rv-email" label="Email"><Input id="rv-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={resend.isPending}>Send a new link</Button>
      </form>
    </AuthCard>
  );
}
