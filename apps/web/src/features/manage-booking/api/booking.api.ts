import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingDto } from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** A booking via its private link token, the parent's session, or an admin session. */
export const useBooking = (reference: string, token: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.booking(reference, token),
    queryFn: () => api.get<BookingDto>(`/bookings/${reference}`, { token }),
    retry: false,
    enabled
  });

/** Cancel, then show the cancelled booking and refresh slots and My bookings. */
export const useCancelBooking = (reference: string, token: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<BookingDto>(`/bookings/${reference}/cancel`, { token }),
    onSuccess: b => {
      qc.setQueryData(queryKeys.booking(reference, token), b);
      qc.invalidateQueries({ queryKey: queryKeys.slots.all });
      qc.invalidateQueries({ queryKey: queryKeys.myBookings });
    }
  });
};
