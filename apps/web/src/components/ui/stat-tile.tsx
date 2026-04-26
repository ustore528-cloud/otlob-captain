import { cn } from "@/lib/utils";

type Tone = "default" | "caution" | "critical";

const valueTone: Record<Tone, string> = {
  default: "text-foreground",
  caution: "text-amber-800",
  critical: "text-red-800",
};

type Props = {
  label: string;
  value: number;
  tone?: Tone;
  className?: string;
};

/** Compact metric for dashboards / reconciliation grids. */
export function StatTile({ label, value, tone = "default", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-card-border bg-muted/15 p-3 text-sm shadow-sm",
        className,
      )}
    >
      <div className="text-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", valueTone[tone])}>{value}</div>
    </div>
  );
}
