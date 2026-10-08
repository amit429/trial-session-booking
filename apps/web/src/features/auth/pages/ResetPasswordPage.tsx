import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api-client";
import { firstFieldError, useResetPassword } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";

const MIN_PASSWORD = 8;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = useResetPassword();
  const expired = isApiError(reset.error) && reset.error.code === "TOKEN_INVALID";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters`);
    setError(null);
    reset.mutate(
      { token: params.get("token") ?? "", password },
      {
        onSuccess: () => {
          toast.success("Password updated", { description: "Sign in with your new password." });
          navigate("/login");
        },
        onError: e2 => setError(firstFieldError(e2))
      }
    );
  };

  if (expired) {
    return (
      <AuthCard icon={<AlertTriangle />} title="This link has expired" description="Reset links work once and for 1 hour.">
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Set a new password" description="You'll be signed out everywhere else.">
      <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
        {error && <Alert variant="destructive" title={error} />}
        <Field id="rp-pw" label="New password" description={`At least ${MIN_PASSWORD} characters.`}>
          <Input id="rp-pw" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={reset.isPending}>
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
