import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownTrigger = M.Trigger;
export function DropdownContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <M.Portal>
      <M.Content align="end" sideOffset={6} className={cn("z-50 min-w-[200px] rounded-lg border border-border bg-card p-1 shadow-lg", className)}>{children}</M.Content>
    </M.Portal>
  );
}
export function DropdownItem({ children, onSelect, destructive }: { children: ReactNode; onSelect?: () => void; destructive?: boolean }) {
  return (
    <M.Item onSelect={onSelect} className={cn("flex h-[34px] cursor-pointer select-none items-center gap-2 rounded-md px-2.5 text-sm outline-none data-[highlighted]:bg-accent [&_svg]:size-4", destructive && "text-destructive-text")}>
      {children}
    </M.Item>
  );
}
export const DropdownLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2.5 pb-1.5 pt-2 text-xs text-muted-foreground">{children}</M.Label>;
export const DropdownSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-border" />;
