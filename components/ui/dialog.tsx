"use client";

import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * MODAL. Velo de tinta al 40 % (sin blur: nada de glassmorphism), superficie cálida,
 * radio 16, sombra suave. Cierre con X y Escape (Radix gestiona foco y scroll-lock).
 * Sin mockup (Q-13): compuesto solo con tokens existentes.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const sizes = {
  sm: "max-w-(--lu-modal-sm)",
  md: "max-w-(--lu-modal-md)",
  lg: "max-w-(--lu-modal-lg)",
} as const;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  size?: keyof typeof sizes;
  /** Oculta la X de cierre (p. ej. cuando el pie ya ofrece "Cancelar"). */
  hideClose?: boolean;
};

export function DialogContent({
  className,
  children,
  size = "md",
  hideClose = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-lu-ink/40",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "duration-200",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5",
          "overflow-y-auto rounded-lu-modal border border-lu-border-subtle bg-lu-surface p-(--lu-space-modal) shadow-lu-modal outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-200",
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className={cn(
              iconButtonVariants({ variant: "ghost", size: "md", shape: "circle" }),
              "absolute top-4 right-4",
            )}
          >
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 pr-10", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-lu-display text-lu-h3 text-lu-text", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-lu-base text-lu-text-secondary", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
