import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header + centred content column for every public page. `narrow` for forms and lists. */
export function PublicLayout({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className={narrow ? "mx-auto max-w-[720px] px-4 pb-24 pt-8" : "mx-auto max-w-[1100px] px-4 pb-24 pt-8"}>{children}</main>
      <SiteFooter />
    </>
  );
}
