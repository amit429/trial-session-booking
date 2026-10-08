import { CalendarDays, LogOut, Sparkles } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useAuth, useLogout } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn("hidden rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex", isActive && "text-foreground");

export function SiteHeader() {
  const { parent, isLoading } = useAuth();
  const logout = useLogout("parent");
  const navigate = useNavigate();

  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success("Signed out");
        navigate("/");
      }
    });

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-4 backdrop-blur-md" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-[60px] max-w-[1100px] items-center gap-2">
        <Logo to="/" />
        <nav aria-label="Main" className="ml-4 flex items-center gap-1">
          <a href="/#how-it-works" className={navLink({ isActive: false })}>How it works</a>
          <NavLink to="/my-bookings" className={navLink}>My bookings</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="size-8 rounded-full" aria-label="Checking your session" />
          ) : parent ? (
            <>
              <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex"><Link to="/book">Book a trial</Link></Button>
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
                  <DropdownItem onSelect={signOut}><LogOut />Sign out</DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
              <Button asChild variant="brand" size="sm"><Link to="/book">Book a free trial</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
