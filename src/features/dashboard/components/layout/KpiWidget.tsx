import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { TREND_COLOR, type TrendDirection } from "./Sparkline";

/**
 * The headline figures at the top of a dashboard tab: one card with a title and the period, and inside it, on a
 * darker inset, the figures side by side (`KpiSlot`s) with thin dividers. On a phone the slots keep their row and
 * scroll sideways, each snapping into view, so the page itself never scrolls sideways.
 */
export function KpiWidget({ title, period, children }: { title: string; period: string; children: ReactNode }) {
  return (
    <Card data-kpi-widget className="dashboard-reveal gap-3 p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span data-widget-period className="text-sm text-muted">
          {period}
        </span>
      </div>
      <div
        data-kpi-group
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-default/50 sm:snap-none sm:overflow-x-visible"
      >
        {children}
      </div>
    </Card>
  );
}

type KpiSlotProps = {
  /** Identifies the figure (data-kpi), e.g. for tests. */
  id: string;
  label: string;
  value: ReactNode;
  /** The line under the value: how it moved, or what it is made of. */
  trend?: ReactNode;
  /** A second, muted line. */
  note?: ReactNode;
  /** Under the value, above the lines: a bar, for instance. */
  children?: ReactNode;
  /** At the right, centred: a `Sparkline`. */
  aside?: ReactNode;
};

/** One figure of a `KpiWidget`. */
export function KpiSlot({ id, label, value, trend, note, children, aside }: KpiSlotProps) {
  return (
    <div
      data-kpi={id}
      className="flex min-w-0 shrink-0 basis-[70%] snap-start items-stretch gap-3 px-4 py-3 sm:flex-1 sm:basis-0 lg:px-5 lg:py-4 [&:not(:first-child)]:border-s [&:not(:first-child)]:border-foreground/15"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span data-slot="label" className="text-sm text-muted">
          {label}
        </span>
        <span data-slot="value" className="text-[1.75rem] font-semibold tabular-nums leading-tight text-foreground lg:text-3xl">
          {value}
        </span>
        {children}
        {trend && (
          <span data-slot="trend" className="text-xs">
            {trend}
          </span>
        )}
        {note && (
          <span data-slot="note" className="text-xs text-muted">
            {note}
          </span>
        )}
      </div>
      {aside}
    </div>
  );
}

const ARROW: Record<TrendDirection, string> = { up: "↑", down: "↓", flat: "→" };

/** An arrow and its figure in the trend's colour; the context follows in muted text (as siblings). */
export function TrendFigure({ direction, children }: { direction: TrendDirection; children: ReactNode }) {
  return (
    <span className="font-medium" style={{ color: TREND_COLOR[direction] }}>
      {ARROW[direction]} {children}
    </span>
  );
}

/** Muted words after a `TrendFigure`. */
export function TrendText({ children }: { children: ReactNode }) {
  return <span className="text-muted">{children}</span>;
}
