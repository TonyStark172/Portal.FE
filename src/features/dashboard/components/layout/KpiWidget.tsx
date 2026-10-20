import { useEffect, useState, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import { Card } from "@heroui/react";
import { useLocale } from "@/shared/i18n";
import { TREND_COLOR, type TrendDirection } from "./Sparkline";

/**
 * The headline figures at the top of a dashboard tab, after HeroUI Pro's "Widget with KPIs": a compact header (title,
 * the period at the right) over a darker inset holding the figures (`KpiSlot`s). The layout follows the widget's own
 * width (container queries), not the screen's:
 * - narrow (a phone): the `hero` figure as a full-width tile, its chart filling the tile's foot, and the others as
 *   tiles two by two under it;
 * - medium (a tablet beside the sidebar): side by side, parted by short lines, without charts, which would squeeze them;
 * - wide (a desktop): side by side, each with its chart.
 * The slots rise into view one after another (`kpi-rise`, which also numbers them for their charts' delays).
 */
export function KpiWidget({ title, period, children }: { title: string; period: string; children: ReactNode }) {
  // The outer box measures the width for the card itself: while the figures are tiles (a phone), the tiles stand on the
  // page on their own, without the card and its inset around them.
  return (
    <div className="dashboard-reveal @container/kpi">
      <Card
        data-kpi-widget
        className="@container gap-0 p-1.5 @max-xl/kpi:gap-1 @max-xl/kpi:bg-transparent @max-xl/kpi:p-0 @max-xl/kpi:shadow-none"
      >
        <div className="flex h-8 items-center justify-between gap-3 px-2.5 @max-xl/kpi:px-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <span data-widget-period className="text-xs text-muted">
            {period}
          </span>
        </div>
        <div
          data-kpi-group
          className="grid grid-cols-2 gap-2 @xl:flex @xl:gap-0 @xl:rounded-xl @xl:bg-[color-mix(in_oklab,var(--surface)_60%,var(--background))] @xl:p-2"
        >
          {children}
        </div>
      </Card>
    </div>
  );
}

/** In a row (a tablet or a desktop), the line before every slot but the first, down its start, short of the edges. */
const SEPARATOR = [
  "[&:not(:first-child)]:@xl:before:absolute",
  "[&:not(:first-child)]:@xl:before:bg-foreground/10",
  "[&:not(:first-child)]:@xl:before:inset-y-4",
  "[&:not(:first-child)]:@xl:before:start-0",
  "[&:not(:first-child)]:@xl:before:w-px",
].join(" ");

type KpiSlotProps = {
  /** Identifies the figure (data-kpi), e.g. for tests. */
  id: string;
  label: string;
  /** The figure that leads: on a phone, a full-width tile over the others, with a bigger value. */
  hero?: boolean;
  /** Small and muted, a figure that qualifies the main one: at the right of the label, or under the trend if narrow. */
  meta?: ReactNode;
  /** The headline figure; a slot may show its figures in `children` instead. */
  value?: ReactNode;
  /** Under the value, above its line, the slot's width: a bar, for instance. */
  children?: ReactNode;
  /** The line under the value: how it moved, or what it is made of. */
  trend?: ReactNode;
  /**
   * A `Sparkline`: on a desktop at the right of the value, bottom-aligned; on a phone across the foot of the hero tile
   * (the other tiles are too small for one); never on a tablet, where it would squeeze the figures.
   */
  chart?: ReactNode;
};

/** One figure of a `KpiWidget`. */
export function KpiSlot({ id, label, hero = false, meta, value, children, trend, chart }: KpiSlotProps) {
  return (
    <div
      data-kpi={id}
      className={`kpi-rise relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg bg-surface p-3 @xl:flex-1 @xl:basis-0 @xl:gap-3 @xl:overflow-visible @xl:rounded-none @xl:bg-transparent @xl:p-4 ${hero ? "col-span-2 pb-14 @xl:pb-4" : ""} ${SEPARATOR}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span data-slot="label" className="truncate text-xs font-medium text-muted @xl:text-sm">
          {label}
        </span>
        {meta && (
          <span data-slot="note" className="hidden shrink-0 text-xs text-muted @3xl:inline">
            {meta}
          </span>
        )}
      </div>
      <div className={`grid items-end gap-x-3 ${chart ? "@3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {value !== undefined && (
            <span
              data-slot="value"
              className={`font-semibold tabular-nums leading-tight text-foreground @xl:text-3xl ${hero ? "text-4xl" : "text-2xl"}`}
            >
              {value}
            </span>
          )}
          {children}
          {trend && (
            <span data-slot="trend" className="text-xs font-medium">
              {trend}
            </span>
          )}
          {/* Narrower than a desktop's slot, it has no room beside the label: under the figure's line instead. */}
          {meta && (
            <span data-slot="note" className="text-xs text-muted @3xl:hidden">
              {meta}
            </span>
          )}
        </div>
        {chart && (
          <div
            data-slot="chart"
            className={
              hero
                ? "absolute inset-x-0 bottom-0 flex h-12 @xl:hidden @3xl:static @3xl:flex @3xl:h-14 @3xl:w-full @3xl:max-w-48 @3xl:justify-self-end"
                : "hidden h-14 w-full max-w-48 justify-self-end @3xl:flex"
            }
          >
            {chart}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A figure that counts up from zero when it first shows, its digits rolling (NumberFlow, which stays still for whoever
 * asks for reduced motion). `text` is the figure as it reads; it is what assistive technology (and a test) gets.
 */
export function CountUp({
  value,
  text,
  signed = false,
  fractionDigits,
  suffix,
}: {
  value: number;
  text: string;
  signed?: boolean;
  /** Decimals shown: `[min, max]` (none by default). */
  fractionDigits?: [number, number];
  /** After the digits, e.g. a unit (" giờ"). */
  suffix?: string;
}) {
  const { locale } = useLocale();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <NumberFlow
        aria-hidden
        value={shown}
        locales={locale}
        suffix={suffix}
        format={{
          signDisplay: signed ? "exceptZero" : "auto",
          ...(fractionDigits && { minimumFractionDigits: fractionDigits[0], maximumFractionDigits: fractionDigits[1] }),
        }}
      />
    </>
  );
}

const ARROW: Record<TrendDirection, string> = { up: "↑", down: "↓", flat: "→" };

/** An arrow and its figure in the trend's colour; the context follows in muted text (as siblings). */
export function TrendFigure({ direction, children }: { direction: TrendDirection; children: ReactNode }) {
  return (
    <span style={{ color: TREND_COLOR[direction] }}>
      {ARROW[direction]} {children}
    </span>
  );
}

/** Muted words after a `TrendFigure`. */
export function TrendText({ children }: { children: ReactNode }) {
  return <span className="text-muted">{children}</span>;
}
