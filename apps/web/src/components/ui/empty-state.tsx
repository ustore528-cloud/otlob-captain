import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Centered empty region — use when a list or block has no rows (not full-page only).
 */
export function EmptyState({ title, description, children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-card-border bg-muted/20 px-4 py-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  );
}
