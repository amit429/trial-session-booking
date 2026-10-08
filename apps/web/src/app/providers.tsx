import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { GlobalProgress } from "@/components/feedback/GlobalProgress";
import { queryClient } from "./query-client";

/** App-wide providers: server-state cache, the top progress bar and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalProgress />
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
