import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** Scrollable table container with consistent border and radius. */
export function TableShell({ className, children, ...rest }: Props) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-card-border bg-background/60 shadow-inner",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
