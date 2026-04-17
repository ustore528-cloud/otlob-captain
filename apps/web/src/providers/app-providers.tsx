import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";

export function AppProviders({ children }: { children: unknown }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children as never}
      <Toaster dir="rtl" position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
