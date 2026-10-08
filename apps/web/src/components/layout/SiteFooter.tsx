import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background px-4">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 py-8 text-[13px] text-muted-foreground">
        <div className="flex flex-col gap-1.5">
          <Logo to="/" />
          <span>Free 1:1 Coding and Maths trial classes. Demo project.</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/book" className="hover:text-foreground">Book a trial</Link>
          <Link to="/my-bookings" className="hover:text-foreground">My bookings</Link>
          <Link to="/signup" className="hover:text-foreground">Create account</Link>
          <Link to="/admin" className="hover:text-foreground">Staff sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
