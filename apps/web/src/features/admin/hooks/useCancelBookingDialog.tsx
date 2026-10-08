import { MENTOR_TIMEZONE, formatSlot, type AdminBookingDto } from "@shared";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api-client";
import { useAdminCancelBooking } from "../api/admin.api";

/** Ask before cancelling on a parent's behalf. Returns `ask(booking)` and the dialog to render. */
export function useCancelBookingDialog() {
  const [target, setTarget] = useState<AdminBookingDto | null>(null);
  const cancel = useAdminCancelBooking();
  const onConfirm = () =>
    target &&
    cancel.mutate(target.reference, {
      onSuccess: () => toast.success("Booking cancelled", { description: "The parent and mentor have been told." }),
      onError: e => toast.error(errorMessage(e)),
      onSettled: () => setTarget(null)
    });
  const dialog = (
    <ConfirmDialog
      open={!!target}
      onOpenChange={o => !o && setTarget(null)}
      title="Cancel this booking?"
      confirmLabel="Cancel booking"
      cancelLabel="Keep booking"
      busy={cancel.isPending}
      description={
        target
          ? `${target.child.name}'s class on ${formatSlot(target.startUtc, MENTOR_TIMEZONE)} will be cancelled. We'll tell the parent and the mentor, and the time becomes free again.`
          : ""
      }
      onConfirm={onConfirm}
    />
  );
  return { ask: setTarget, dialog };
}
