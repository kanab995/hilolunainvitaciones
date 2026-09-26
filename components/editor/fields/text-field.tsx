"use client";

import type { ComponentProps } from "react";
import { Field, fieldErrorId, fieldHintId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Shared = {
  /** `id` único del control (lo usan la etiqueta, la ayuda y el error). */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Mensaje de validación (tokens `--lu-error`). */
  error?: string;
  hint?: string;
  /** Máximo de caracteres: muestra el contador "11 / 50" del mockup. */
  max?: number;
  optional?: boolean;
  tone?: "sans" | "serif";
  className?: string;
};

const describedBy = (id: string, error?: string, hint?: string) => (error ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined);

/** Etiqueta + `Input` del Design System + contador + error. Todo campo del editor tiene etiqueta. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  max,
  optional,
  tone,
  className,
  ...input
}: Shared & Omit<ComponentProps<typeof Input>, "id" | "value" | "onChange" | "className" | "tone">) {
  return (
    <Field htmlFor={id} label={label} error={error} hint={hint} optional={optional} counter={max ? { value: value.length, max } : undefined} className={className}>
      <Input id={id} tone={tone} value={value} invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} onChange={(event) => onChange(event.target.value)} {...input} />
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  max,
  optional,
  tone,
  className,
  ...textarea
}: Shared & Omit<ComponentProps<typeof Textarea>, "id" | "value" | "onChange" | "className" | "tone">) {
  return (
    <Field htmlFor={id} label={label} error={error} hint={hint} optional={optional} counter={max ? { value: value.length, max } : undefined} className={className}>
      <Textarea id={id} tone={tone} value={value} invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} onChange={(event) => onChange(event.target.value)} {...textarea} />
    </Field>
  );
}
