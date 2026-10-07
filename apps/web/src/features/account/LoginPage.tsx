import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { AuthCard } from "./AuthCard";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<"bad" | "rate" | "pending" | "other" | null>(null);

  const login = useMutation({
    mutationFn: () => api.post<{ parent: { name: string } }>("/auth/parent/login", { email: email.trim(), password }),
    onSuccess: r => {
      qc.invalidateQueries();
      toast.success("Signed in", { description: `Welcome back, ${r.parent.name.split(" ")[0]}` });
      const next = params.get("next");
      navigate(next && next.startsWith("/") ? next : "/my-bookings");
    },
    onError: e => setProblem(e instanceof ApiError ? (e.code === "INVALID_CREDENTIALS" ? "bad" : e.code === "RATE_LIMITED" ? "rate" : e.code === "EMAIL_NOT_VERIFIED" ? "pending" : "other") : "other")
  });
  const resend = useMutation({
    mutationFn: () => api.post("/auth/parent/resend-verification", { email: email.trim() }),
    onSuccess: () => toast.success("Check your email", { description: "We've sent a new verification link." })
  });

  return (
    <AuthCard title="Welcome back" description="Sign in to see and manage your trial bookings."
      footer={<>Don't have an account? <Link className="font-medium text-foreground underline underline-offset-4" to="/signup">Sign up</Link></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={e => { e.preventDefault(); setProblem(null); login.mutate(); }}>
        {problem === "bad" && <Alert variant="destructive" icon={<XCircle />} title="Email or password is incorrect">Check both and try again.</Alert>}
        {problem === "rate" && <Alert variant="destructive" icon={<Lock />} title="Too many attempts">Try again in a minute.</Alert>}
        {problem === "other" && <Alert variant="destructive" title="Something went wrong">Please try again.</Alert>}
        {problem === "pending" && (
          <Alert variant="warning" icon={<Mail />} title="Please verify your email first">
            We sent a link to {email.trim()} when you signed up.{" "}
            <button type="button" className="cursor-pointer font-medium text-foreground underline underline-offset-4" onClick={() => resend.mutate()}>Send a new link</button>
          </Alert>
        )}
        <Field id="li-email" label="Email"><Input id="li-email" type="email" autoComplete="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><label htmlFor="li-pw" className="text-sm font-medium">Password</label><Link to="/forgot-password" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">Forgot password?</Link></div>
          <Input id="li-pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthCard>
  );
}
