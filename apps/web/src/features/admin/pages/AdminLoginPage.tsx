import { Lock, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layout";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api-client";
import { useAdminLogin } from "../api/admin.api";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("admin@trialdesk.example");
  const [password, setPassword] = useState("");
  const login = useAdminLogin();
  const rateLimited = isApiError(login.error) && login.error.code === "RATE_LIMITED";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          toast.success("Signed in", { description: "Welcome to the admin console" });
          const next = params.get("next");
          navigate(next?.startsWith("/admin") ? next : "/admin");
        }
      }
    );
  };

  return (
    <PublicLayout narrow>
      <Card className="mx-auto mt-6 max-w-[400px]">
        <CardContent className="flex flex-col gap-[18px] p-7">
          <div className="flex flex-col gap-2">
            <Badge className="self-start">
              <Lock />
              Staff only
            </Badge>
            <h1 className="text-2xl font-semibold">Admin sign in</h1>
            <p className="text-muted-foreground">Manage trials, parents and mentor schedules.</p>
          </div>
          <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
            {login.isError && (
              <Alert
                variant="destructive"
                icon={rateLimited ? <Lock /> : <XCircle />}
                title={rateLimited ? "Too many attempts" : "Email or password is incorrect"}
              >
                {rateLimited ? "Try again in a minute." : "Check both and try again."}
              </Alert>
            )}
            <Field id="al-email" label="Email">
              <Input id="al-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
            <Field id="al-pw" label="Password">
              <Input
                id="al-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
