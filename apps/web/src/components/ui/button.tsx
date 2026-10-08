import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:opacity-90",
        brand: "bg-brand text-brand-foreground shadow-xs hover:brightness-110",
        outline: "border border-border bg-background shadow-xs hover:bg-accent",
        secondary: "bg-muted hover:bg-border",
        ghost: "hover:bg-accent",
        destructive: "bg-destructive text-white shadow-xs hover:opacity-90",
        "destructive-ghost": "text-destructive-text hover:bg-destructive-soft",
        link: "h-auto p-0 underline underline-offset-4 hover:text-brand-text"
      },
      size: { default: "h-9 px-3.5", sm: "h-8 rounded-[7px] px-2.5 text-[13px]", lg: "h-10 px-[18px]", icon: "size-9", "icon-sm": "size-8 rounded-[7px]" }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
