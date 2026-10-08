import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type Crumb = { label: string; to?: string };

/** Breadcrumb bar + padded content area for every admin page. */
export function AdminPage({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  return (
    <>
      <div className="flex h-14 items-center border-b border-border px-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              <ChevronRight />
              {c.to && i < crumbs.length - 1 ? (
                <Link to={c.to} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex min-w-0 flex-col gap-5 p-4 md:p-6">{children}</div>
    </>
  );
}

export const PageTitle = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {children && <p className="text-muted-foreground">{children}</p>}
  </div>
);
