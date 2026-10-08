import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AdminDto, MeResponse, ParentDto } from "@shared";
import { api } from "@/lib/api-client";

export const ME_KEY = ["me"] as const;

export function useAuth() {
  const q = useQuery({ queryKey: ME_KEY, queryFn: () => api.get<MeResponse>("/auth/me"), staleTime: 60_000 });
  return { parent: q.data?.parent ?? null, admin: q.data?.admin ?? null, isLoading: q.isLoading, isFetching: q.isFetching };
}

/**
 * Record a sign-in or sign-out in the cache *before* navigating, so route guards see the new
 * session immediately instead of a stale "signed out" answer. Then refresh everything else.
 */
export function setSession(qc: QueryClient, patch: { parent?: ParentDto | null; admin?: AdminDto | null }) {
  qc.setQueryData<MeResponse>(ME_KEY, old => ({ parent: old?.parent ?? null, admin: old?.admin ?? null, ...patch }));
  qc.invalidateQueries({ predicate: q => q.queryKey[0] !== ME_KEY[0] });
}

export function useLogout(kind: "parent" | "admin") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>(`/auth/${kind}/logout`),
    onSuccess: () => setSession(qc, kind === "parent" ? { parent: null } : { admin: null })
  });
}
