import { useEffect, useMemo, useState } from "react";
import { assignmentOfferSecondsLeft } from "@/features/distribution/captain-map-visual";

type Props = {
  /** ISO expiry from API (`pendingOfferExpiresAt`) — same source as captain app / map. */
  expiresAtIso: string | null | undefined;
};

/**
 * Live seconds remaining until `expiresAtIso` (1 Hz). Not a standalone fake timer.
 */
export function DistributionOrderOfferCountdown({ expiresAtIso }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!expiresAtIso) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [expiresAtIso]);

  const secondsLeft = useMemo(() => {
    if (!expiresAtIso) return null;
    void tick;
    return assignmentOfferSecondsLeft(expiresAtIso);
  }, [expiresAtIso, tick]);

  if (secondsLeft == null) return null;

  const urgent = secondsLeft <= 10;

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none ${
        urgent
          ? "border-destructive/55 bg-destructive/10 text-destructive"
          : "border-amber-700/35 bg-amber-500/12 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50"
      }`}
      title="ثوانٍ متبقية لمهلة قبول/رفض العرض — من الخادم (متزامنة مع الكابتن والخريطة)"
    >
      <span className="font-normal opacity-90">مهلة</span>
      <span dir="ltr" className="min-w-[2ch] text-center font-mono text-xs">
        {secondsLeft}
      </span>
      <span className="font-normal opacity-90">ث</span>
      <span className="font-normal opacity-75">/ 30</span>
    </div>
  );
}
