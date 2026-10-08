import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/** Minimal Radix-style Slot: merges props and className onto its single child. */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, className, ...props }, ref) => {
    if (!isValidElement(children)) return null;
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { ...props, ref, className: cn(className, child.props.className) } as never);
  }
);
Slot.displayName = "Slot";
