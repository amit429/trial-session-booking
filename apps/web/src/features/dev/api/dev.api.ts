import { useQuery } from "@tanstack/react-query";
import type { OutboxDto } from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const POLL_MS = 4_000;

/** Latest outgoing emails, polled so new verify/reset links appear without a refresh. */
export const useDevOutbox = () =>
  useQuery({ queryKey: queryKeys.devOutbox, queryFn: () => api.get<OutboxDto[]>("/dev/outbox", { limit: 60 }), refetchInterval: POLL_MS, retry: false });
