import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "muted";

const styles: Record<Variant, string> = {
  default: "border border-primary/25 bg-primary/10 text-primary",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-200 bg-amber-50 text-amber-900",
  danger: "border border-red-200 bg-red-50 text-red-800",
  muted: "border border-card-border bg-card text-muted",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", styles[variant], className)}
      {...props}
    />
  );
}
