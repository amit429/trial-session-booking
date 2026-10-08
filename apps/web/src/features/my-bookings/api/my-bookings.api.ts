import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { BookingDto } from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** Every booking made with the signed-in parent's email. */
export const useMyBookings = () => useQuery({ queryKey: queryKeys.myBookings, queryFn: () => api.get<BookingDto[]>("/me/bookings", { scope: "all" }) });

/** Cancel one of the parent's bookings (authorised by their session), then refresh lists and slots. */
export const useCancelMyBooking = (options: Pick<UseMutationOptions<BookingDto, Error, string>, "onSuccess" | "onError"> = {}) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => api.post<BookingDto>(`/bookings/${reference}/cancel`, {}),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.myBookings });
      qc.invalidateQueries({ queryKey: queryKeys.slots.all });
      options.onSuccess?.(...args);
    }
  });
};
