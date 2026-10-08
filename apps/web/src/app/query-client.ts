import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: err => {
      // An expired session mid-use: refresh "who am I" so guards redirect to the right login.
      if (err instanceof ApiError && err.status === 401) queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  }),
  defaultOptions: {
    queries: { retry: (n, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 0) && n < 2, refetchOnWindowFocus: true }
  }
});
