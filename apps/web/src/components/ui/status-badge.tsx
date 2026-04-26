import type { HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeTone = "neutral" | "positive" | "caution" | "critical" | "info";

const toneToBadge: Record<StatusBadgeTone, "default" | "success" | "warning" | "danger" | "muted"> = {
  neutral: "muted",
  positive: "success",
  caution: "warning",
  critical: "danger",
  info: "default",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone: StatusBadgeTone;
};

/**
 * Semantic status chip — maps to `Badge` variants for consistent wallet / state labels.
 */
export function StatusBadge({ tone, className, ...props }: Props) {
  return <Badge variant={toneToBadge[tone]} className={cn("font-medium", className)} {...props} />;
}
