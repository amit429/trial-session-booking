import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatClockMinutes,
  localClockMinutes,
  localDate,
  type BookingDto,
  type CreateBookingRequest,
  type SlotsResponse,
  type SuggestionsResponse
} from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const SLOTS_STALE_MS = 30_000;

/** The next 14 days of class times in the parent's zone. */
export const useSlots = (tz: string | null) =>
  useQuery({
    queryKey: queryKeys.slots.forZone(tz ?? ""),
    queryFn: () => api.get<SlotsResponse>("/slots", { tz: tz ?? "" }),
    enabled: !!tz,
    staleTime: SLOTS_STALE_MS
  });

/** Alternatives for a full time (or a fully booked day), keyed by the parent-local date and clock time. */
export const useSuggestions = (tz: string | null, startUtc: string | null, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.slots.suggestions(tz ?? "", startUtc ?? ""),
    queryFn: () =>
      api.get<SuggestionsResponse>("/slots/suggestions", {
        tz: tz ?? "",
        date: localDate(startUtc ?? "", tz ?? "UTC"),
        time: formatClockMinutes(localClockMinutes(startUtc ?? "", tz ?? "UTC"), true)
      }),
    enabled: enabled && !!tz && !!startUtc
  });

/** Book with an Idempotency-Key so retries and double clicks create one booking. Slots refresh either way. */
export const useCreateBooking = (idempotencyKey: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBookingRequest) => api.post<BookingDto>("/bookings", body, { "Idempotency-Key": idempotencyKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myBookings }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.slots.all })
  });
};
