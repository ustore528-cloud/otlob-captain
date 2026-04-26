import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "error" | "success" | "warning" | "info";

const styles: Record<Variant, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-primary/20 bg-primary/5 text-foreground",
};

const icons: Record<Variant, ReactNode> = {
  error: <AlertCircle className="size-4 shrink-0 opacity-90" aria-hidden />,
  success: <CheckCircle2 className="size-4 shrink-0 opacity-90" aria-hidden />,
  warning: <AlertTriangle className="size-4 shrink-0 opacity-90" aria-hidden />,
  info: <Info className="size-4 shrink-0 opacity-90" aria-hidden />,
};

type Props = {
  variant: Variant;
  children: ReactNode;
  className?: string;
};

/**
 * Inline message — validation, API errors, export failures. Not a toast.
 */
export function InlineAlert({ variant, children, className }: Props) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
        styles[variant],
        className,
      )}
    >
      {icons[variant]}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
