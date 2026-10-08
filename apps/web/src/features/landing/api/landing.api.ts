import { useQuery } from "@tanstack/react-query";
import type { SlotDto, SlotsResponse } from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** The first few open class times in the visitor's zone, for the hero preview (shares the slots cache). */
export const useNextOpenTimes = (tz: string | null, count = 3) =>
  useQuery({
    queryKey: queryKeys.slots.forZone(tz ?? ""),
    queryFn: () => api.get<SlotsResponse>("/slots", { tz: tz ?? "" }),
    enabled: !!tz,
    staleTime: 30_000,
    select: (r): SlotDto[] => r.days.flatMap(d => d.slots.filter(s => s.status === "OPEN")).slice(0, count)
  });
