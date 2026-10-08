import { Lock, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api-client";
import { useParentLogin, useResendVerification } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";

type Problem = "bad" | "rate" | "pending" | "other";

const problemFor = (e: unknown): Problem => {
  if (!isApiError(e)) return "other";
  if (e.code === "INVALID_CREDENTIALS") return "bad";
  if (e.code === "RATE_LIMITED") return "rate";
  if (e.code === "EMAIL_NOT_VERIFIED") return "pending";
  return "other";
};

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const login = useParentLogin();
  const resend = useResendVerification();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: r => {
          toast.success("Signed in", { description: `Welcome back, ${r.parent.name.split(" ")[0]}` });
          const next = params.get("next");
          navigate(next?.startsWith("/") ? next : "/my-bookings");
        },
        onError: e2 => setProblem(problemFor(e2))
      }
    );
  };
  const resendLink = () =>
    resend.mutate(email.trim(), {
      onSuccess: () => toast.success("Check your email", { description: "We've sent a new verification link." })
    });

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to see and manage your trial bookings."
      footer={
        <>
          Don't have an account?{" "}
          <Link className="font-medium text-foreground underline underline-offset-4" to="/signup">
            Sign up
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
        {problem === "bad" && (
          <Alert variant="destructive" icon={<XCircle />} title="Email or password is incorrect">
            Check both and try again.
          </Alert>
        )}
        {problem === "rate" && (
          <Alert variant="destructive" icon={<Lock />} title="Too many attempts">
            Try again in a minute.
          </Alert>
        )}
        {problem === "other" && (
          <Alert variant="destructive" title="Something went wrong">
            Please try again.
          </Alert>
        )}
        {problem === "pending" && (
          <Alert variant="warning" icon={<Mail />} title="Please verify your email first">
            We sent a link to {email.trim()} when you signed up.{" "}
            <button type="button" className="cursor-pointer font-medium text-foreground underline underline-offset-4" onClick={resendLink}>
              Send a new link
            </button>
          </Alert>
        )}
        <Field id="li-email" label="Email">
          <Input
            id="li-email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="li-pw" className="text-sm font-medium">
              Password
            </label>
            <Link to="/forgot-password" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="li-pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
