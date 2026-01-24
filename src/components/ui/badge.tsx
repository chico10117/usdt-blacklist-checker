import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border-l-2 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-l-primary bg-primary/10 text-primary",
        secondary: "border-l-muted-foreground/50 bg-secondary text-secondary-foreground",
        outline: "border-l-border bg-transparent text-foreground border border-border",
        success: "border-l-success bg-success/10 text-success",
        warning: "border-l-warning bg-warning/10 text-warning-foreground dark:text-warning",
        danger: "border-l-danger bg-danger/10 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
