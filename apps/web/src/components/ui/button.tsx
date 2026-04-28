import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Button hierarchy (dashboard):
 * - `default` — primary action (one main CTA per card or section).
 * - `secondary` — supporting actions: refresh, export, pagination, “load more”.
 * - `ghost` — low-emphasis / toolbar.
 * - `destructive` — irreversible or dangerous (use sparingly).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-95",
        secondary:
          "border border-card-border bg-card text-foreground shadow-sm hover:bg-accent/80",
        ghost: "hover:bg-card/60",
        destructive: "bg-red-600 text-white hover:bg-red-600/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = (asChild ? Slot : "button") as unknown as "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
    />
  );
}
