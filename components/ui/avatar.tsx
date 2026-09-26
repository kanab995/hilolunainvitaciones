import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full bg-lu-surface-tint font-lu-display text-lu-text",
  {
    variants: {
      size: {
        sm: "size-8 text-lu-title-sm",
        md: "size-10 text-lu-title-sm",
        lg: "size-12 text-lu-title-md",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type AvatarProps = ComponentProps<"span"> &
  VariantProps<typeof avatarVariants> & {
    /** Nombre completo; se muestra la inicial. Sin foto: los avatares de los mockups son demo. */
    name: string;
  };

export function Avatar({ name, size, className, ...props }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
