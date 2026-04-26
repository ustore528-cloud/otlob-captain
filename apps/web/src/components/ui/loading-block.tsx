import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  message?: string;
  /** Tighter padding for inside cards / table slots */
  compact?: boolean;
  className?: string;
};

export function LoadingBlock({ message = "جارٍ التحميل…", compact, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-muted",
        compact ? "py-4" : "py-10",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 shrink-0 animate-spin opacity-80" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
