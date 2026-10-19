import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { TREND_COLOR, type TrendDirection } from "./Sparkline";

/**
 * The headline figures at the top of a dashboard tab, after HeroUI Pro's "Widget with KPIs": a compact header (title,
 * the period at the right) over a darker inset holding the figures (`KpiSlot`s) side by side, parted by short lines.
 * The layout follows the widget's own width (container queries), not the screen's: wide (a desktop) the slots share
 * the row with a small chart each; narrower (a tablet beside the sidebar) they share it without charts; narrower still
 * (a phone) they keep their row and scroll sideways, each snapping into view, so the page never scrolls sideways.
 */
export function KpiWidget({ title, period, children }: { title: string; period: string; children: ReactNode }) {
  return (
    <Card data-kpi-widget className="dashboard-reveal @container gap-0 p-1.5">
      <div className="flex h-8 items-center justify-between gap-3 px-2.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span data-widget-period className="text-xs text-muted">
          {period}
        </span>
      </div>
      <div
        data-kpi-group
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] bg-[color-mix(in_oklab,var(--surface)_60%,var(--background))] p-1 @xl:snap-none @xl:overflow-x-visible @xl:p-2"
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
  /** Small and muted, a figure that qualifies the main one: at the right of the label, or under the trend if narrow. */
  meta?: ReactNode;
  value: ReactNode;
  /** The line under the value: how it moved, or what it is made of. */
  trend?: ReactNode;
  /** At the right of the value and its line, bottom-aligned; only on a wide widget (a desktop). */
  chart?: ReactNode;
  /** "fill": the chart takes two fifths of the slot (a sparkline); "fit": its own size (a ring). */
  chartSize?: "fill" | "fit";
};

/** One figure of a `KpiWidget`. */
export function KpiSlot({ id, label, meta, value, trend, chart, chartSize = "fill" }: KpiSlotProps) {
  return (
    <div
      data-kpi={id}
      className="relative flex min-w-0 shrink-0 basis-[70%] snap-start flex-col gap-3 p-4 @xl:flex-1 @xl:basis-0 [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:inset-y-4 [&:not(:first-child)]:before:start-0 [&:not(:first-child)]:before:w-px [&:not(:first-child)]:before:bg-foreground/10"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span data-slot="label" className="truncate text-sm font-medium text-muted">
          {label}
        </span>
        {meta && (
          <span data-slot="note" className="hidden shrink-0 text-xs text-muted @3xl:inline">
            {meta}
          </span>
        )}
      </div>
      <div
        className={`grid grid-cols-1 items-end gap-x-3 ${chartSize === "fill" ? "@3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "@3xl:grid-cols-[minmax(0,1fr)_auto]"}`}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span data-slot="value" className="text-3xl font-semibold tabular-nums leading-tight text-foreground">
            {value}
          </span>
          {trend && (
            <span data-slot="trend" className="text-xs font-medium">
              {trend}
            </span>
          )}
          {/* Too narrow for it beside the label: under the figure's line instead. */}
          {meta && (
            <span data-slot="note" className="text-xs text-muted @3xl:hidden">
              {meta}
            </span>
          )}
        </div>
        {chart && <div className="hidden min-w-0 justify-end @3xl:flex">{chart}</div>}
      </div>
    </div>
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
