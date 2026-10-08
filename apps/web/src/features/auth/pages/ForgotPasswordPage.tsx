import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-client";
import { useForgotPassword } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";

const backToSignIn = (
  <Link className="font-medium text-foreground underline underline-offset-4" to="/login">
    Back to sign in
  </Link>
);

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgot = useForgotPassword();

  if (forgot.isSuccess) {
    return (
      <AuthCard
        icon={<Mail />}
        title="Check your email"
        description="If an account exists for that email, we've sent a reset link. It works for 1 hour."
        footer={backToSignIn}
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/dev/outbox">Open dev outbox</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new password."
      footer={backToSignIn}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault();
          forgot.mutate(email.trim());
        }}
      >
        {forgot.isError && <Alert variant="destructive" title={errorMessage(forgot.error)} />}
        <Field id="fp-email" label="Email">
          <Input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={forgot.isPending}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
