import type { BookingDto } from "@shared";
import { Badge } from "@/components/ui/badge";

/** Confirmed / Completed / Cancelled, derived from status and start time. */
export function StatusBadge({ booking }: { booking: Pick<BookingDto, "status" | "startUtc"> }) {
  if (booking.status === "CANCELLED")
    return (
      <Badge variant="destructive" dot>
        Cancelled
      </Badge>
    );
  if (new Date(booking.startUtc) <= new Date()) return <Badge variant="secondary">Completed</Badge>;
  return (
    <Badge variant="success" dot>
      Confirmed
    </Badge>
  );
}
