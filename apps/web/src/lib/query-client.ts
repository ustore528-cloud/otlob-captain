import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/http";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, err) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const queryClient = createAppQueryClient();
