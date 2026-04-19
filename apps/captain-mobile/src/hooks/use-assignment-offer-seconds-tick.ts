import { useEffect, useMemo, useState } from "react";
import { assignmentOfferSecondsLeft } from "@/lib/assignment-offer-seconds-left";

/**
 * Recomputes every second so UI matches dispatcher `assignmentOfferSecondsLeft` while the offer is active.
 */
export function useAssignmentOfferSecondsTick(expiresAt: string | null | undefined, active: boolean): number | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active || !expiresAt) return;
    setTick(0);
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active, expiresAt]);

  return useMemo(() => {
    if (!active) return null;
    void tick;
    return assignmentOfferSecondsLeft(expiresAt ?? null);
  }, [active, expiresAt, tick]);
}
