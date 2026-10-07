import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@trial/shared";
import { api } from "./api";

export function useAuth() {
  const q = useQuery({ queryKey: ["me"], queryFn: () => api.get<MeResponse>("/auth/me"), staleTime: 60_000 });
  return { parent: q.data?.parent ?? null, admin: q.data?.admin ?? null, isLoading: q.isLoading };
}

export function useLogout(kind: "parent" | "admin") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>(`/auth/${kind}/logout`),
    onSuccess: () => qc.invalidateQueries()
  });
}
