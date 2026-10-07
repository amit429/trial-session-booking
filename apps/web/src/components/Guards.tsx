import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "./ui/card";

function Loading() {
  return <div className="mx-auto mt-24 flex max-w-[400px] flex-col gap-3 px-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /></div>;
}

export function RequireParent({ children }: { children: React.ReactNode }) {
  const { parent, isLoading, isFetching } = useAuth();
  const loc = useLocation();
  // Wait for an in-flight session check before deciding to send someone to sign in.
  if (isLoading || (!parent && isFetching)) return <Loading />;
  if (!parent) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export function RequireAdmin() {
  const { admin, isLoading, isFetching } = useAuth();
  const loc = useLocation();
  if (isLoading || (!admin && isFetching)) return <Loading />;
  if (!admin) return <Navigate to={`/admin/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}
