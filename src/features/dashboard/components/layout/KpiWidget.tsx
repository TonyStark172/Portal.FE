import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { TREND_COLOR, type TrendDirection } from "./Sparkline";

/**
 * The headline figures at the top of a dashboard tab, after HeroUI Pro's "Widget with KPIs": a compact header (title,
 * the period at the right) over a darker inset holding the figures (`KpiSlot`s), parted by short lines. The layout
 * follows the widget's own width (container queries), not the screen's:
 * - narrow (a phone): the figures one under another, each a full-width row with its chart at the right;
 * - medium (a tablet beside the sidebar): side by side, without charts, which would squeeze the figures;
 * - wide (a desktop): side by side, each with its chart.
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
        className="flex flex-col rounded-xl bg-[color-mix(in_oklab,var(--surface)_60%,var(--background))] p-1 @xl:flex-row @xl:p-2"
      >
        {children}
      </div>
    </Card>
  );
}

/** The line before every slot but the first: across its top when stacked, down its start (short of the edges) in a row. */
const SEPARATOR = [
  "[&:not(:first-child)]:before:absolute",
  "[&:not(:first-child)]:before:bg-foreground/10",
  "[&:not(:first-child)]:before:inset-x-4",
  "[&:not(:first-child)]:before:top-0",
  "[&:not(:first-child)]:before:h-px",
  "[&:not(:first-child)]:@xl:before:inset-x-auto",
  "[&:not(:first-child)]:@xl:before:inset-y-4",
  "[&:not(:first-child)]:@xl:before:start-0",
  "[&:not(:first-child)]:@xl:before:h-auto",
  "[&:not(:first-child)]:@xl:before:w-px",
].join(" ");

type KpiSlotProps = {
  /** Identifies the figure (data-kpi), e.g. for tests. */
  id: string;
  label: string;
  /** Small and muted, a figure that qualifies the main one: at the right of the label, or under the trend if narrow. */
  meta?: ReactNode;
  value: ReactNode;
  /** Under the value, above its line, the slot's width: a bar, for instance. */
  children?: ReactNode;
  /** The line under the value: how it moved, or what it is made of. */
  trend?: ReactNode;
  /** At the right of the value and its line, bottom-aligned: a `Sparkline`. Not on a tablet, where it would squeeze them. */
  chart?: ReactNode;
};

/** One figure of a `KpiWidget`. */
export function KpiSlot({ id, label, meta, value, children, trend, chart }: KpiSlotProps) {
  return (
    <div data-kpi={id} className={`relative flex min-w-0 flex-col gap-3 p-4 @xl:flex-1 @xl:basis-0 ${SEPARATOR}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span data-slot="label" className="truncate text-sm font-medium text-muted">
          {label}
        </span>
        {meta && (
          <span data-slot="note" className="shrink-0 text-xs text-muted @xl:hidden @3xl:inline">
            {meta}
          </span>
        )}
      </div>
      <div
        className={`grid items-end gap-x-3 ${chart ? "grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @xl:grid-cols-1 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1"}`}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span data-slot="value" className="text-3xl font-semibold tabular-nums leading-tight text-foreground">
            {value}
          </span>
          {children}
          {trend && (
            <span data-slot="trend" className="text-xs font-medium">
              {trend}
            </span>
          )}
          {/* A tablet's slot is too narrow for it beside the label: under the figure's line instead. */}
          {meta && (
            <span data-slot="note" className="hidden text-xs text-muted @xl:inline @3xl:hidden">
              {meta}
            </span>
          )}
        </div>
        {chart && <div className="flex min-w-0 justify-end @xl:hidden @3xl:flex">{chart}</div>}
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
