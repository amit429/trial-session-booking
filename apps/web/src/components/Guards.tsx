import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AdminContentSkeleton, Busy, ListSkeleton, PageHeaderSkeleton } from "./skeletons";

function Loading() {
  return <Busy label="Checking your session"><div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 pt-[92px]"><PageHeaderSkeleton action /><ListSkeleton /></div></Busy>;
}
function AdminLoading() {
  return <Busy label="Checking your session"><div className="m-2 rounded-xl border border-border bg-background md:ml-[256px]"><AdminContentSkeleton /></div></Busy>;
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
  if (isLoading || (!admin && isFetching)) return <AdminLoading />;
  if (!admin) return <Navigate to={`/admin/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}
