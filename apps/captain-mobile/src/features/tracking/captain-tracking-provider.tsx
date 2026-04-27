import { createContext, useContext, type ReactNode } from "react";
import { useCaptainTrackingState, type UseCaptainTrackingResult } from "./use-captain-tracking";

const CaptainTrackingContext = createContext<UseCaptainTrackingResult | null>(null);

export function CaptainTrackingProvider({ children }: { children: ReactNode }) {
  const value = useCaptainTrackingState();
  return <CaptainTrackingContext.Provider value={value}>{children}</CaptainTrackingContext.Provider>;
}

export function useCaptainTracking(): UseCaptainTrackingResult {
  const ctx = useContext(CaptainTrackingContext);
  if (!ctx) {
    throw new Error("useCaptainTracking must be used within CaptainTrackingProvider");
  }
  return ctx;
}
