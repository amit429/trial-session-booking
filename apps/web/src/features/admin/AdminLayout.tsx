import { CalendarDays, ChevronRight, GraduationCap, Inbox, LayoutDashboard, LogOut, Users } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { AdminContentSkeleton } from "@/components/skeletons";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useLogout } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; Icon: typeof LayoutDashboard; end?: boolean };
const nav: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ to: "/admin", label: "Dashboard", Icon: LayoutDashboard, end: true }] },
  { group: "Manage", items: [
    { to: "/admin/bookings", label: "Bookings", Icon: CalendarDays },
    { to: "/admin/parents", label: "Parents", Icon: Users },
    { to: "/admin/mentors", label: "Mentors", Icon: GraduationCap }
  ] },
  { group: "System", items: [{ to: "/admin/outbox", label: "Outbox", Icon: Inbox }] }
];

export function AdminLayout() {
  const { admin } = useAuth();
  const logout = useLogout("admin");
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen grid-cols-1 bg-sidebar md:grid-cols-[248px_minmax(0,1fr)]">
      <aside aria-label="Admin" className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-2.5 md:sticky md:top-0 md:h-screen md:flex-col md:flex-nowrap md:items-stretch md:border-b-0 md:py-3.5">
        <Link to="/admin" className="flex items-center gap-2.5 px-2 py-1.5 text-[15px] font-semibold md:pb-3.5">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white"><GraduationCap className="size-4" /></span>TrialDesk
        </Link>
        {nav.map(g => (
          <div key={g.group} className="contents">
            <p className="hidden px-2 pb-1.5 pt-3.5 text-xs font-medium text-muted-foreground md:block">{g.group}</p>
            {g.items.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 font-medium hover:bg-accent [&_svg]:size-4", isActive && "bg-accent font-semibold")}>
                <Icon />{label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2.5 rounded-lg px-2 py-2 md:ml-0 md:mt-auto">
          {admin ? <Avatar name={admin.name} size="sm" /> : <Skeleton className="size-7 rounded-full" />}
          <div className="hidden min-w-0 flex-col md:flex"><span className="text-[13px] font-semibold">{admin?.name}</span><span className="truncate text-xs text-muted-foreground">{admin?.email}</span></div>
          <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" className="md:ml-auto"
            onClick={() => logout.mutate(undefined, { onSuccess: () => { toast.success("Signed out"); navigate("/admin/login"); } })}><LogOut /></Button>
        </div>
      </aside>
      <section className="m-2 flex min-w-0 flex-col rounded-xl border border-border bg-background shadow-xs md:ml-0">
        <Suspense fallback={<AdminContentSkeleton />}><Outlet /></Suspense>
      </section>
    </div>
  );
}

export function AdminPage({ crumbs, children }: { crumbs: { label: string; to?: string }[]; children: ReactNode }) {
  return (
    <>
      <div className="flex h-14 items-center border-b border-border px-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
          <Link to="/admin" className="hover:text-foreground">Admin</Link>
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              <ChevronRight />
              {c.to && i < crumbs.length - 1 ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className="font-medium text-foreground">{c.label}</span>}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex min-w-0 flex-col gap-5 p-4 md:p-6">{children}</div>
    </>
  );
}

export const PageTitle = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="flex flex-col gap-1"><h1 className="text-2xl font-semibold">{title}</h1>{children && <p className="text-muted-foreground">{children}</p>}</div>
);
