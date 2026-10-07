import { CalendarDays, LogOut, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, useLogout } from "@/lib/auth";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "./ui/dropdown";
import { Logo } from "./Logo";

export function SiteHeader() {
  const { parent } = useAuth();
  const logout = useLogout("parent");
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1100px] items-center gap-2">
        <Logo />
        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm"><Link to="/my-bookings">My bookings</Link></Button>
          {parent ? (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account menu"><Avatar name={parent.name} size="sm" /></Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel><span className="block text-[13.5px] font-semibold text-foreground">{parent.name}</span>{parent.email}</DropdownLabel>
                <DropdownSeparator />
                <DropdownItem onSelect={() => navigate("/my-bookings")}><CalendarDays />My bookings</DropdownItem>
                <DropdownItem onSelect={() => navigate("/book")}><Sparkles />Book a trial</DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={() => logout.mutate(undefined, { onSuccess: () => { toast.success("Signed out"); navigate("/book"); } })}><LogOut />Sign out</DropdownItem>
              </DropdownContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm"><Link to="/login">Sign in</Link></Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicLayout({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className={narrow ? "mx-auto max-w-[720px] px-4 pb-24 pt-8" : "mx-auto max-w-[1100px] px-4 pb-24 pt-8"}>{children}</main>
    </>
  );
}
