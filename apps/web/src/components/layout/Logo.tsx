import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ to = "/book" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-brand text-white"><GraduationCap className="size-4" /></span>
      TrialDesk
    </Link>
  );
}
