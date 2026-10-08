import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** AlertDialog-style confirm (shadcn pattern on Radix Dialog). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Keep it", onConfirm, busy }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; busy?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in" />
        <D.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 rounded-xl border border-border bg-card p-[22px] shadow-2xl">
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          <D.Description className="text-muted-foreground">{description}</D.Description>
          <div className="mt-2.5 flex flex-wrap justify-end gap-2">
            <D.Close asChild><Button variant="outline">{cancelLabel}</Button></D.Close>
            <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Right-hand sheet (shadcn Sheet on Radix Dialog). */
export function Sheet({ open, onOpenChange, title, subtitle, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <D.Content className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-border bg-card shadow-2xl")}>
          <div className="flex items-start justify-between gap-3 border-b border-border px-[22px] py-5">
            <div className="flex flex-col gap-1">
              {subtitle}
              <D.Title className="text-lg font-semibold">{title}</D.Title>
            </div>
            <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close"><X /></Button></D.Close>
          </div>
          <D.Description className="sr-only">Booking details</D.Description>
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-[22px] py-3.5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
