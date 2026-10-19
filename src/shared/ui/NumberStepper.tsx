"use client";

import type { ComponentProps, ReactNode } from "react";
import NumberFlow, { type Format } from "@number-flow/react";
import { Description, FieldError, Label, NumberField } from "@heroui/react";
import { Minus, Plus } from "@gravity-ui/icons";

type Size = "sm" | "md";

const SIZES: Record<Size, { button: string; value: string }> = {
  sm: { button: "size-7", value: "h-7 min-w-5 text-xs" },
  md: { button: "size-8", value: "h-8 min-w-6 text-sm" },
};

const GROUP =
  "relative inline-flex! h-auto! w-fit items-center overflow-visible! rounded-full! border-0! bg-default! p-0.5 " +
  "shadow-none! ring-0! data-[focus-visible=true]:shadow-[0_0_0_2px_var(--focus)]! transition-none!";

/** Rolls up on +, down on −. */
const trend = (previous: number, next: number) => Math.sign(next - previous);

type Props = Omit<ComponentProps<typeof NumberField>, "children" | "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
  /** A visible label; without it pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  decrementLabel: string;
  incrementLabel: string;
  /** Shown after the number, e.g. " %". */
  suffix?: string;
  size?: Size;
};

/**
 * A − / number / + pill, after HeroUI Pro's Number Stepper: the number rolls to its new value (NumberFlow), upwards on +
 * and downwards on −, and the round buttons shrink a little when pressed. The field itself is clipped away but stays for
 * forms, screen readers and the arrow keys; the rolling number is what is seen, also while the field has the focus.
 * NumberFlow and the buttons follow the reduced-motion preference.
 */
export function NumberStepper({
  value, onChange, label, description, errorMessage, decrementLabel, incrementLabel, suffix, size = "md", className, ...props
}: Props) {
  const sizes = SIZES[size];
  const button =
    `${sizes.button} flex shrink-0 cursor-[var(--cursor-interactive)] items-center justify-center rounded-full bg-surface ` +
    "text-muted shadow-[var(--surface-shadow)] outline-none transition-[background-color,box-shadow,transform,color] " +
    "duration-100 ease-out hover:text-foreground data-[pressed=true]:scale-[0.98] motion-reduce:transition-none " +
    "disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)]";

  return (
    <NumberField value={value} onChange={onChange} className={className} {...props}>
      {label && <Label>{label}</Label>}
      {/* HeroUI dresses this group as a text field (border, hover and focus-within colours, a ring on any focus); the
          stepper is a plain pill instead, with a ring for keyboard focus only. */}
      <NumberField.Group className={GROUP}>
        <NumberField.DecrementButton aria-label={decrementLabel} className={button}>
          <Minus className="size-4" />
        </NumberField.DecrementButton>
        <span aria-hidden className={`${sizes.value} flex items-center justify-center font-semibold leading-[0.85] text-foreground tabular-nums`}>
          {Number.isFinite(value) ? (
            // NumberFlow shows the number as the field formats it (NumberFlow has no scientific notation, never used here).
            <NumberFlow value={value} suffix={suffix} trend={trend} format={{ useGrouping: false, ...props.formatOptions } as Format} />
          ) : (
            "–"
          )}
        </span>
        <NumberField.IncrementButton aria-label={incrementLabel} className={button}>
          <Plus className="size-4" />
        </NumberField.IncrementButton>
        <NumberField.Input className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" />
      </NumberField.Group>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </NumberField>
  );
}
