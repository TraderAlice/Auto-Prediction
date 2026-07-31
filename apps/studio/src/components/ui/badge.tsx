import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        verified:
          "border-primary/25 bg-primary/8 text-primary shadow-[inset_0_0_12px_color-mix(in_oklab,var(--primary)_8%,transparent)]",
        shadow: "border-violet/25 bg-violet/8 text-violet",
        muted: "border-border bg-muted text-muted-foreground",
        warning: "border-warning/25 bg-warning/8 text-warning",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
